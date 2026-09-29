'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, Loader2, MonitorUp, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import {
  grabFrame,
  requestEntireScreen,
  screenCaptureSupported,
} from '@/lib/proctor/screen-capture';
import { cn } from '@/lib/utils';

type EventType = 'SESSION_START' | 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'PAGE_LEFT' | 'SHARE_STOPPED';
type EventResult = { eventId: string | null; leaveCount?: number; autoSubmitted?: boolean };

/**
 * Mốc chụp màn hình, tính từ lúc rời bài. Dày ở đầu để bắt đúng thứ học sinh
 * vừa mở ra, thưa dần nếu rời lâu. Không chụp ngay lúc 0: khi đó màn hình
 * thường vẫn đang là trang bài làm.
 */
const CAPTURE_SCHEDULE_MS = [800, 4_000, 15_000, 45_000, 90_000];

/**
 * Lượt báo PAGE_LEFT đang chờ, theo attemptId. React Strict Mode (dev) gỡ rồi
 * gắn lại component ngay lập tức — gắn lại trong cùng tick thì huỷ lượt báo,
 * nếu không mỗi lần mở bài ở dev sẽ bị tính oan một lần rời.
 */
const pendingPageLeft = new Map<string, number>();

type AwayState = {
  hidden: boolean;
  eventId: Promise<string | null>;
  timers: number[];
};

type Props = {
  attemptId: string;
  /** Bắt chia sẻ toàn bộ màn hình để chụp minh chứng. false = chỉ đếm số lần rời. */
  requireScreen: boolean;
  initialLeaveCount: number;
  /** Rời quá số lần này thì máy chủ tự nộp bài. null = không tự nộp. */
  maxLeaves: number | null;
  children: ReactNode;
};

/**
 * Giám sát rời bài khi làm quiz.
 *
 * "Rời bài" là lúc trang làm bài mất focus hoặc bị ẩn: chuyển tab, chuyển cửa
 * sổ/ứng dụng, thu nhỏ trình duyệt, đóng/tải lại trang, hoặc bấm sang trang
 * khác ngay trong hệ thống. Mỗi lượt được ghi lên máy chủ (giờ máy chủ), và nếu
 * học sinh đã chia sẻ màn hình thì chụp vài ảnh minh chứng trong lúc ở ngoài.
 *
 * Bấm vào khung xem trước code web (iframe) cũng làm cửa sổ "blur", nhưng khi
 * đó `document.hasFocus()` vẫn đúng vì focus nằm trong khung con — nên mọi
 * quyết định đều dựa vào `hasFocus()` + `visibilityState`, không dựa vào sự
 * kiện blur trần.
 */
export function ExamProctor({
  attemptId,
  requireScreen,
  initialLeaveCount,
  maxLeaves,
  children,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<'gate' | 'active' | 'paused'>(
    requireScreen ? 'gate' : 'active'
  );
  const [leaveCount, setLeaveCount] = useState(initialLeaveCount);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  // Chỉ biết được sau khi chạy trên trình duyệt; mặc định true để HTML dựng ở
  // máy chủ không lệch với lần hydrate đầu.
  const [supported, setSupported] = useState(true);
  const started = phase !== 'gate';

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const awayRef = useRef<AwayState | null>(null);
  const suspendRef = useRef(false);
  const everActiveRef = useRef(false);
  const shareStoppedRef = useRef<Promise<string | null> | null>(null);
  // Bản sao của leaveCount cho các hàm chạy trong listener (state ở đó bị cũ).
  const leaveCountRef = useRef(initialLeaveCount);
  // Máy chủ đã tự nộp bài vì rời quá số lần cho phép.
  const autoSubmittedRef = useRef(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    setSupported(screenCaptureSupported());
  }, []);

  function sendEvent(type: EventType, meta?: Record<string, unknown>): Promise<EventResult | null> {
    return apiClient
      .post<EventResult>(
        `/attempts/${attemptId}/proctor/events`,
        { type, clientAt: new Date().toISOString(), meta },
        // Đóng tab: sự kiện "ẩn trang" bắn ra ngay trước khi trang bị huỷ, không
        // có keepalive thì request bị trình duyệt cắt ngang.
        { keepalive: true }
      )
      .catch(() => null);
  }

  function endEvent(eventId: Promise<string | null>, hidden?: boolean) {
    void eventId.then((id) => {
      if (!id) return;
      void apiClient
        .post(`/attempts/${attemptId}/proctor/events/${id}/end`, { hidden })
        .catch(() => {});
    });
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    videoRef.current = null;
  }

  async function capture(state: AwayState) {
    const stream = streamRef.current;
    if (!stream || awayRef.current !== state) return;
    const blob = await grabFrame(stream, videoRef.current);
    const eventId = await state.eventId;
    if (!blob || !eventId) return;

    const form = new FormData();
    form.append('file', blob, 'man-hinh.jpg');
    form.append('attemptId', attemptId);
    form.append('eventId', eventId);
    form.append('capturedAtClient', new Date().toISOString());
    await fetch('/api/upload/proctor-snapshot', { method: 'POST', body: form }).catch(() => {});
  }

  function updateLeaveCount(n: number) {
    leaveCountRef.current = n;
    setLeaveCount(n);
  }

  /**
   * Máy chủ đã nộp bài. Chờ học sinh quay lại mới chuyển trang: trong lúc em còn
   * ở ngoài, lịch chụp vẫn chạy để lấy minh chứng cho chính lượt rời cuối này.
   */
  function finishAutoSubmit() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopStream();
    toast.dismiss('proctor-leave');
    toast.error(
      `Bài đã được tự động nộp vì bạn rời khỏi trang làm bài quá ${maxLeaves ?? 0} lần.`,
      { id: 'proctor-auto-submit', duration: 10_000 }
    );
    // Cùng địa chỉ: trang lượt làm tự hiện kết quả khi bài không còn "đang làm".
    router.refresh();
  }

  function beginAway(type: 'TAB_HIDDEN' | 'WINDOW_BLUR') {
    const state: AwayState = {
      hidden: type === 'TAB_HIDDEN',
      eventId: sendEvent(type).then((r) => {
        if (r?.leaveCount !== undefined) updateLeaveCount(r.leaveCount);
        if (r?.autoSubmitted) {
          autoSubmittedRef.current = true;
          // Học sinh đã quay lại trước khi máy chủ kịp trả lời.
          if (awayRef.current !== state) finishAutoSubmit();
        }
        return r?.eventId ?? null;
      }),
      timers: [],
    };
    awayRef.current = state;
    updateLeaveCount(leaveCountRef.current + 1);

    if (streamRef.current) {
      state.timers = CAPTURE_SCHEDULE_MS.map((ms) =>
        window.setTimeout(() => void capture(state), ms)
      );
    }
  }

  function endAway() {
    const state = awayRef.current;
    if (!state) return;
    awayRef.current = null;
    state.timers.forEach((t) => window.clearTimeout(t));
    endEvent(state.eventId, state.hidden);
    if (autoSubmittedRef.current) {
      finishAutoSubmit();
      return;
    }

    const recorded = requireScreen
      ? 'Lần rời này đã được ghi lại kèm ảnh chụp màn hình.'
      : 'Lần rời này đã được ghi lại.';
    const remaining = maxLeaves === null ? null : maxLeaves - leaveCountRef.current;
    const limit =
      remaining === null
        ? ''
        : remaining > 0
          ? ` Bạn chỉ còn được rời bài ${remaining} lần nữa, quá số đó bài sẽ tự động nộp.`
          : ' Bạn đã hết lượt được phép rời bài — rời thêm một lần nữa bài sẽ tự động nộp.';
    toast.warning(`Bạn vừa rời khỏi trang làm bài. ${recorded}${limit}`, {
      id: 'proctor-leave',
      duration: remaining !== null && remaining <= 0 ? 10_000 : undefined,
    });
  }

  // ── Theo dõi rời bài ──────────────────────────────────────────
  useEffect(() => {
    if (!started) return;

    const pending = pendingPageLeft.get(attemptId);
    if (pending !== undefined) {
      // Strict Mode gắn lại: phiên cũ vẫn tiếp tục, không phải lượt vào bài mới.
      window.clearTimeout(pending);
      pendingPageLeft.delete(attemptId);
    } else if (!requireScreen) {
      // Có chia sẻ màn hình thì SESSION_START đã gửi lúc chia sẻ thành công.
      void sendEvent('SESSION_START', envMeta(null, false));
    }

    // Trang bài làm được giữ nguyên trạng thái rồi hiện lại (Next bật
    // cacheComponents thì trang cũ chỉ bị ẩn, không bị gỡ): luồng chia sẻ đã bị
    // dừng lúc rời trang, nên bắt chia sẻ lại — cũng là lúc gửi SESSION_START.
    if (requireScreen && !streamRef.current) {
      setPhase('gate');
      return;
    }

    const check = () => {
      if (suspendRef.current) return;
      const hidden = document.visibilityState === 'hidden';
      const focused = document.hasFocus();
      // Chỉ tính rời bài sau khi học sinh đã thực sự ở trong trang bài làm (hiện
      // và có focus) ít nhất một lần — trang mở ở tab nền thì chưa có gì để "rời".
      if (!hidden && focused) everActiveRef.current = true;
      if (!everActiveRef.current) return;
      const away = hidden || !focused;

      const current = awayRef.current;
      if (away && !current) beginAway(hidden ? 'TAB_HIDDEN' : 'WINDOW_BLUR');
      else if (away && current && hidden) current.hidden = true;
      else if (!away && current) endAway();
    };
    // Đợi một nhịp sau blur: lúc bấm vào iframe, focus chưa kịp chuyển sang khung con.
    const onBlur = () => window.setTimeout(check, 60);

    document.addEventListener('visibilitychange', check);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', check);
    // Dự phòng: focus đang nằm trong iframe rồi mới Alt+Tab thì trang cha không
    // nhận được blur nào — chỉ hỏi định kỳ mới phát hiện được.
    const poll = window.setInterval(check, 1000);
    check();

    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', check);
      window.clearInterval(poll);

      const timer = window.setTimeout(() => {
        pendingPageLeft.delete(attemptId);
        const away = awayRef.current;
        if (away) {
          away.timers.forEach((t) => window.clearTimeout(t));
          awayRef.current = null;
        }
        stopStream();
        // Trang bài làm bị gỡ trong khi trình duyệt vẫn mở: học sinh bấm sang
        // trang khác của hệ thống. Nộp bài xong cũng đi qua đây, nhưng khi đó máy
        // chủ thấy bài đã nộp và bỏ qua.
        if (!away) void sendEvent('PAGE_LEFT');
      }, 0);
      pendingPageLeft.set(attemptId, timer);
    };
    // Cố ý không liệt kê các hàm bên trong (chúng chỉ đọc ref): chạy lại effect
    // mỗi lần chúng đổi danh tính sẽ bị tính là một lần rời trang.
  }, [started, attemptId, requireScreen]);

  // ── Chia sẻ màn hình ──────────────────────────────────────────
  function attachStream(stream: MediaStream) {
    streamRef.current = stream;
    // Thẻ <video> chỉ để dự phòng cho Firefox (không có ImageCapture).
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    void video.play().catch(() => {});
    videoRef.current = video;

    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (streamRef.current !== stream) return;
      streamRef.current = null;
      videoRef.current = null;
      shareStoppedRef.current = sendEvent('SHARE_STOPPED').then((r) => r?.eventId ?? null);
      setPhase('paused');
    });
  }

  async function handleShare() {
    setSharing(true);
    setShareError(null);
    // Hộp chọn màn hình của trình duyệt làm trang mất focus — không phải rời bài.
    suspendRef.current = true;
    const result = await requestEntireScreen();
    window.setTimeout(() => {
      suspendRef.current = false;
    }, 800);
    setSharing(false);

    if (!result.ok) {
      setShareError(result.message);
      return;
    }
    attachStream(result.stream);

    if (phase === 'gate') {
      void sendEvent('SESSION_START', envMeta(result.surface, true));
    } else if (shareStoppedRef.current) {
      // Chia sẻ lại: khép lượt ngừng chia sẻ để biết bài bị che bao lâu.
      endEvent(shareStoppedRef.current);
      shareStoppedRef.current = null;
    }
    setPhase('active');
  }

  // ── Giao diện ─────────────────────────────────────────────────
  if (phase === 'gate') {
    return (
      <ShareGate
        maxLeaves={maxLeaves}
        supported={supported}
        sharing={sharing}
        error={shareError}
        onShare={() => void handleShare()}
      />
    );
  }

  return (
    <>
      <div
        className={cn(
          'mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-xs',
          leaveCount > 0
            ? 'border-amber-600/25 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
            : 'border-border bg-muted/40 text-muted-foreground'
        )}
      >
        <span className="flex items-center gap-1.5 font-semibold">
          <Eye className="h-3.5 w-3.5" />
          Bài kiểm tra có giám sát
        </span>
        <span>
          Mỗi lần rời khỏi trang làm bài (chuyển tab, chuyển cửa sổ, mở trang khác)
          {requireScreen ? ' đều được ghi lại kèm ảnh chụp màn hình.' : ' đều được ghi lại.'}
        </span>
        {maxLeaves !== null && <span>Rời quá {maxLeaves} lần, bài sẽ tự động nộp.</span>}
        <span className="ml-auto font-semibold whitespace-nowrap">
          Đã rời bài: {leaveCount}
          {maxLeaves !== null ? `/${maxLeaves}` : ''} lần
        </span>
      </div>

      {/* Luôn giữ bài làm trong CÙNG một thẻ bọc, chỉ đổi thuộc tính: đổi cấu trúc
          cây sẽ khiến React gỡ rồi dựng lại QuizTaker — mất câu trả lời đang gõ dở
          và đồng hồ đếm ngược. */}
      <div
        inert={phase === 'paused'}
        className={cn(phase === 'paused' && 'pointer-events-none blur-sm select-none')}
      >
        {children}
      </div>
      {phase === 'paused' && (
        <SharePausedOverlay
          sharing={sharing}
          error={shareError}
          onShare={() => void handleShare()}
        />
      )}
    </>
  );
}

function envMeta(surface: string | null, screenshots: boolean): Record<string, unknown> {
  const screen = window.screen as Screen & { isExtended?: boolean };
  return {
    surface: surface ?? undefined,
    // Chrome/Edge: máy có nhiều màn hình. Chỉ chia sẻ được một màn hình, nên đây
    // là thông tin giáo viên cần biết khi đọc ảnh chụp.
    isExtended: screen.isExtended,
    screenWidth: screen.width,
    screenHeight: screen.height,
    screenshots,
    userAgent: navigator.userAgent,
  };
}

function ShareGate({
  maxLeaves,
  supported,
  sharing,
  error,
  onShare,
}: {
  maxLeaves: number | null;
  supported: boolean;
  sharing: boolean;
  error: string | null;
  onShare: () => void;
}) {
  return (
    <div className="border-border bg-card mx-auto max-w-2xl space-y-5 rounded-xl border p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <Eye className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Bài kiểm tra có giám sát</h2>
          <p className="text-muted-foreground text-sm">
            Bạn cần chia sẻ màn hình trước khi làm bài.
          </p>
        </div>
      </div>

      <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
        <li>
          Hệ thống ghi lại{' '}
          <strong className="text-foreground">mỗi lần bạn rời khỏi trang làm bài</strong>: chuyển
          tab, chuyển sang cửa sổ hay ứng dụng khác, thu nhỏ trình duyệt, đóng/tải lại trang hoặc mở
          trang khác.
        </li>
        <li>
          Màn hình <strong className="text-foreground">chỉ được chụp vào lúc bạn rời bài</strong> để
          làm minh chứng. Khi bạn đang làm bài trên trang này, không có ảnh nào được chụp.
        </li>
        <li>Giáo viên xem được số lần rời bài, thời gian rời và các ảnh chụp.</li>
        {maxLeaves !== null && (
          <li>
            Rời bài quá <strong className="text-foreground">{maxLeaves} lần</strong>, bài sẽ tự động
            nộp ngay.
          </li>
        )}
        <li>Nếu dừng chia sẻ giữa chừng, bài làm sẽ bị che lại cho tới khi bạn chia sẻ lại.</li>
      </ul>

      <div className="bg-muted/40 space-y-1 rounded-lg p-3 text-sm">
        <p className="font-semibold">Cách chia sẻ</p>
        <p className="text-muted-foreground">
          Bấm nút bên dưới → chọn mục <strong className="text-foreground">Toàn bộ màn hình</strong>{' '}
          (Entire screen) → chọn màn hình → bấm <strong className="text-foreground">Chia sẻ</strong>
          .
        </p>
      </div>

      {!supported && (
        <p className="text-destructive flex items-start gap-2 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Trình duyệt hoặc thiết bị này không hỗ trợ chia sẻ màn hình. Hãy làm bài trên máy tính
          bằng Chrome, Edge hoặc Firefox.
        </p>
      )}
      {error && supported && (
        <p className="text-destructive flex items-start gap-2 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <Button onClick={onShare} disabled={!supported || sharing} className="w-full gap-2" size="lg">
        {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorUp className="h-4 w-4" />}
        {sharing ? 'Đang chờ bạn chọn màn hình…' : 'Chia sẻ màn hình và vào bài'}
      </Button>
    </div>
  );
}

function SharePausedOverlay({
  sharing,
  error,
  onShare,
}: {
  sharing: boolean;
  error: string | null;
  onShare: () => void;
}) {
  return (
    <div className="bg-background/70 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-labelledby="proctor-paused-title"
        className="border-border bg-card w-full max-w-md space-y-4 rounded-xl border p-6 text-center shadow-lg"
      >
        <div className="bg-destructive/10 text-destructive mx-auto flex h-12 w-12 items-center justify-center rounded-lg">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 id="proctor-paused-title" className="text-lg font-bold">
            Bạn đã dừng chia sẻ màn hình
          </h2>
          <p className="text-muted-foreground text-sm">
            Việc này đã được ghi lại. Thời gian làm bài vẫn tiếp tục chạy — hãy chia sẻ lại toàn bộ
            màn hình để làm tiếp.
          </p>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button onClick={onShare} disabled={sharing} className="w-full gap-2">
          {sharing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MonitorUp className="h-4 w-4" />
          )}
          {sharing ? 'Đang chờ bạn chọn màn hình…' : 'Chia sẻ lại màn hình'}
        </Button>
      </div>
    </div>
  );
}
