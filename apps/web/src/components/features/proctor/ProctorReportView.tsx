'use client';

import { useEffect, useState } from 'react';
import {
  AppWindow,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Loader2,
  LogIn,
  MonitorOff,
  MonitorSmartphone,
  PanelTop,
  RotateCcw,
  Send,
} from 'lucide-react';
import type { ProctorEventItem, ProctorReport, ProctorSnapshotItem } from '@lumibach/types';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function fmtClock(d: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    hour12: false,
  }).format(new Date(d));
}

function fmtTime(d: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(d));
}

/** 75_000 → "1 phút 15 giây". */
export function fmtAway(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} giây`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} giờ ${m} phút`;
  return s > 0 ? `${m} phút ${s} giây` : `${m} phút`;
}

const LEAVE_TYPES = new Set(['TAB_HIDDEN', 'WINDOW_BLUR', 'PAGE_LEFT']);

function describe(e: ProctorEventItem, isFirstSession: boolean) {
  switch (e.type) {
    case 'SESSION_START':
      return {
        label: isFirstSession ? 'Vào bài' : 'Mở lại trang bài làm',
        icon: isFirstSession ? LogIn : RotateCcw,
        tone: 'neutral' as const,
      };
    case 'TAB_HIDDEN':
      return {
        label: e.meta?.reopened
          ? 'Rời trang bài làm (đóng / tải lại trang hoặc tắt trình duyệt)'
          : 'Chuyển tab hoặc thu nhỏ trình duyệt',
        icon: PanelTop,
        tone: 'leave' as const,
      };
    case 'WINDOW_BLUR':
      return {
        label: 'Chuyển sang cửa sổ / ứng dụng khác',
        icon: AppWindow,
        tone: 'leave' as const,
      };
    case 'PAGE_LEFT':
      return { label: 'Mở trang khác trong hệ thống', icon: PanelTop, tone: 'leave' as const };
    case 'SHARE_STOPPED':
      return { label: 'Dừng chia sẻ màn hình', icon: MonitorOff, tone: 'danger' as const };
    case 'AUTO_SUBMITTED':
      return {
        label: `Hệ thống tự động nộp bài (rời quá ${String(e.meta?.maxLeaves ?? '?')} lần)`,
        icon: Send,
        tone: 'danger' as const,
      };
  }
}

type Props = { attemptId: string };

/** Nhật ký giám sát rời bài của một lượt làm: số lần, thời gian rời, ảnh minh chứng. */
export function ProctorReportView({ attemptId }: Props) {
  const [report, setReport] = useState<ProctorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ list: ProctorSnapshotItem[]; index: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<ProctorReport>(`/attempts/${attemptId}/proctor`)
      .then((r) => !cancelled && setReport(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Không tải được.'));
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!report) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải nhật ký giám sát…
      </div>
    );
  }

  const snapshotCount = report.events.reduce((n, e) => n + e.snapshots.length, 0);
  const sessions = report.events.filter((e) => e.type === 'SESSION_START');
  const firstSessionId = sessions[0]?.id;
  const multiScreen = sessions.some((e) => e.meta?.isExtended === true);
  const noScreenshots = sessions.length > 0 && sessions.every((e) => e.meta?.screenshots === false);

  return (
    <div className="space-y-4">
      {/* Tổng hợp */}
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label={report.maxLeaves !== null ? 'Số lần rời / tối đa' : 'Số lần rời bài'}
          value={
            report.maxLeaves !== null
              ? `${report.leaveCount}/${report.maxLeaves}`
              : String(report.leaveCount)
          }
          warn={report.leaveCount > 0}
        />
        <Stat
          label="Thời gian ngoài bài"
          value={report.awayMs > 0 ? fmtAway(report.awayMs) : '0 giây'}
          warn={report.awayMs > 0}
        />
        <Stat label="Ảnh chụp màn hình" value={String(snapshotCount)} />
      </div>

      {multiScreen && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-600/25 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <MonitorSmartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Máy của học sinh có nhiều màn hình. Trình duyệt chỉ chia sẻ được một màn hình, nên ảnh
          chụp có thể không thấy nội dung ở màn hình còn lại.
        </p>
      )}
      {noScreenshots && (
        <p className="text-muted-foreground text-xs">
          Lượt làm này không chụp màn hình (quiz chỉ bật đếm số lần rời, hoặc học sinh làm trong
          Safe Exam Browser).
        </p>
      )}

      {report.events.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Chưa có sự kiện giám sát nào cho lượt làm này.
        </p>
      ) : (
        <ol className="border-border space-y-3 border-l pl-4">
          {report.events.map((e) => {
            const d = describe(e, e.id === firstSessionId);
            const Icon = d.icon;
            const isLeave = LEAVE_TYPES.has(e.type);
            return (
              <li key={e.id} className="relative space-y-2">
                <span
                  className={cn(
                    'border-background absolute top-1 -left-[1.4rem] flex h-5 w-5 items-center justify-center rounded-full border-2',
                    d.tone === 'neutral' && 'bg-muted text-muted-foreground',
                    d.tone === 'leave' && 'bg-amber-500 text-white',
                    d.tone === 'danger' && 'bg-destructive text-white'
                  )}
                >
                  <Icon className="h-2.5 w-2.5" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">
                    {fmtClock(e.occurredAt)}
                  </span>
                  <span className={cn('text-sm', d.tone !== 'neutral' && 'font-semibold')}>
                    {d.label}
                  </span>
                  {(isLeave || e.type === 'SHARE_STOPPED') && (
                    <span className="text-muted-foreground text-xs">
                      {e.durationMs != null
                        ? `· ${e.type === 'SHARE_STOPPED' ? 'không chia sẻ' : 'rời'} ${fmtAway(e.durationMs)}`
                        : '· chưa thấy quay lại'}
                    </span>
                  )}
                  {Number(e.meta?.captureFailures) > 0 && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      · {String(e.meta?.captureFailures)} lần không lấy được ảnh (trình duyệt chặn
                      chụp khi đang ở tab khác)
                    </span>
                  )}
                </div>

                {e.snapshots.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {e.snapshots.map((p, i) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setViewer({ list: e.snapshots, index: i })}
                        className="group border-border relative block overflow-hidden rounded-md border"
                      >
                        {/* Ảnh đi qua endpoint có kiểm quyền — không dùng next/image
                            vì bộ tối ưu ảnh không mang cookie đăng nhập theo. */}
                        <img
                          src={p.url}
                          alt={`Ảnh chụp màn hình lúc ${fmtClock(p.serverReceivedAt)}`}
                          loading="lazy"
                          className="aspect-video w-full object-cover transition-opacity group-hover:opacity-80"
                        />
                        <span className="absolute right-0 bottom-0 left-0 bg-black/55 px-1 py-0.5 text-[10px] text-white tabular-nums">
                          {fmtTime(p.serverReceivedAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <SnapshotViewer viewer={viewer} onChange={setViewer} />
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="border-border bg-card rounded-lg border px-3 py-2 text-center">
      <p className="text-muted-foreground text-[11px] font-semibold">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-base font-bold tabular-nums',
          warn && 'text-amber-700 dark:text-amber-400'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SnapshotViewer({
  viewer,
  onChange,
}: {
  viewer: { list: ProctorSnapshotItem[]; index: number } | null;
  onChange: (v: { list: ProctorSnapshotItem[]; index: number } | null) => void;
}) {
  const current = viewer ? viewer.list[viewer.index] : null;
  const go = (delta: number) => {
    if (!viewer) return;
    const index = viewer.index + delta;
    if (index >= 0 && index < viewer.list.length) onChange({ ...viewer, index });
  };

  return (
    <Dialog open={!!current} onOpenChange={(open) => !open && onChange(null)}>
      <DialogContent className="max-w-5xl sm:max-w-5xl">
        <DialogTitle className="flex items-center gap-2 pr-8">
          <Eye className="h-4 w-4" />
          Ảnh chụp màn hình lúc {current ? fmtClock(current.serverReceivedAt) : ''}
        </DialogTitle>
        {current && (
          <img
            src={current.url}
            alt=""
            className="max-h-[70vh] w-full rounded-md border object-contain"
          />
        )}
        {viewer && current && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={viewer.index === 0}
                className="border-border hover:bg-muted rounded-md border p-1.5 disabled:opacity-40"
                aria-label="Ảnh trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-muted-foreground px-2 text-xs tabular-nums">
                {viewer.index + 1}/{viewer.list.length}
              </span>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={viewer.index === viewer.list.length - 1}
                className="border-border hover:bg-muted rounded-md border p-1.5 disabled:opacity-40"
                aria-label="Ảnh sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <a
              href={current.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <ExternalLink className="h-4 w-4" /> Mở ảnh gốc
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
