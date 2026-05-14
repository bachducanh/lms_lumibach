'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ScratchEditor } from './ScratchEditor';
import { Sb3Upload } from './Sb3Upload';
import { apiClient } from '@/lib/api-client';
import { Send, Info, History, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type Submission = {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  submittedAt: Date;
  attemptNumber: number;
  code: string;
  gradedAt: Date | null;
};

type Props = {
  exerciseId: string;
  starterUrl: string | null;
  initialSubs: Submission[];
};

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

function parseSb3Url(code: string): string | null {
  try {
    return (JSON.parse(code) as { sb3Url?: string }).sb3Url ?? null;
  } catch {
    return null;
  }
}

export function ScratchTakePanel({ exerciseId, starterUrl, initialSubs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [hasSelfHost, setHasSelfHost] = useState<boolean | null>(null);
  const [subs] = useState<Submission[]>(initialSubs);

  // Detect self-hosted scratch-gui to tailor the instructions banner
  useEffect(() => {
    let cancelled = false;
    fetch('/scratch-gui/editor.html', { method: 'HEAD' })
      .then((r) => {
        if (!cancelled) setHasSelfHost(r.ok);
      })
      .catch(() => {
        if (!cancelled) setHasSelfHost(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Manual submit (drag-drop .sb3) ──────────────────────────

  function handleSubmit() {
    if (!pendingUrl) {
      toast.error('Hãy tải file .sb3 lên trước khi nộp bài.');
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.post(`/scratch/${exerciseId}/submit`, {
          sb3Url: pendingUrl,
          filename: pendingName ?? undefined,
        });
        toast.success('Đã nộp bài.');
        setPendingUrl(null);
        setPendingName(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  // ── 1-click submit (Phase B) ────────────────────────────────
  // Self-hosted scratch-gui posts the .sb3 blob via postMessage when student
  // saves. We upload it to MinIO and submit, all without leaving the page.

  async function handleSaveBlob(blob: Blob, filename: string) {
    if (autoSubmitting) return;
    setAutoSubmitting(true);
    const t = toast.loading(`Đang lưu "${filename}"...`);

    try {
      // 1. Upload .sb3 to MinIO
      const fd = new FormData();
      fd.append('file', new File([blob], filename, { type: 'application/x.scratch.sb3' }));
      fd.append('kind', 'submission');
      fd.append('exerciseId', exerciseId);

      const upRes = await fetch('/api/upload/scratch', { method: 'POST', body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) {
        toast.error(upData.error ?? 'Upload thất bại.', { id: t });
        return;
      }

      // 2. Create submission
      await apiClient.post(`/scratch/${exerciseId}/submit`, { sb3Url: upData.url, filename });

      toast.success('Đã nộp bài tự động!', { id: t });
      router.refresh();
    } catch {
      toast.error('Lỗi mạng khi nộp bài tự động.', { id: t });
    } finally {
      setAutoSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Instructions banner */}
      <div className="flex gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-sm">
        {hasSelfHost ? (
          <>
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <div className="space-y-1.5">
              <p className="font-semibold text-orange-300">Nộp bài tự động</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Lập trình xong, trong Scratch chỉ cần vào menu{' '}
                <strong className="text-foreground">File → Save to your computer</strong> — bài sẽ
                tự nộp về LMS, không cần thao tác gì thêm.
              </p>
            </div>
          </>
        ) : (
          <>
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <div className="space-y-1.5">
              <p className="font-semibold text-orange-300">Hướng dẫn 3 bước</p>
              <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-xs">
                <li>
                  Bấm <strong className="text-foreground">Mở Scratch Editor</strong> ở khung bên
                  dưới.
                </li>
                <li>
                  Code xong, vào{' '}
                  <strong className="text-foreground">File → Save to your computer</strong> để tải{' '}
                  <code className="font-mono text-orange-300">.sb3</code>.
                </li>
                <li>
                  Kéo file <code className="font-mono text-orange-300">.sb3</code> vào ô{' '}
                  <strong className="text-foreground">Nộp bài</strong> bên dưới → bấm{' '}
                  <strong className="text-foreground">Nộp bài</strong>.
                </li>
              </ol>
            </div>
          </>
        )}
      </div>

      {/* Scratch editor — iframe (self-hosted) or new-tab fallback */}
      <ScratchEditor starterUrl={starterUrl} onSaveBlob={handleSaveBlob} />

      {/* Manual submission area — only shown when self-host is OFF (otherwise auto) */}
      {hasSelfHost === false && (
        <div className="border-border bg-card space-y-4 rounded-xl border p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Nộp bài</h3>
            {subs.length > 0 && (
              <span className="text-muted-foreground text-xs">
                Lần thứ {subs[0]!.attemptNumber + 1}
              </span>
            )}
          </div>

          <Sb3Upload
            kind="submission"
            exerciseId={exerciseId}
            onUploaded={(url, name) => {
              setPendingUrl(url || null);
              setPendingName(name || null);
            }}
          />

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!pendingUrl || pending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {pending ? 'Đang nộp...' : 'Nộp bài'}
            </Button>
          </div>
        </div>
      )}

      {/* My submission history */}
      {subs.length > 0 && (
        <div className="border-border bg-card space-y-3 rounded-xl border p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <History className="text-muted-foreground h-4 w-4" />
            Lịch sử nộp bài ({subs.length})
          </h3>
          <div className="space-y-2">
            {subs.map((s) => {
              const url = parseSb3Url(s.code);
              const isGraded = !!s.gradedAt;
              return (
                <div
                  key={s.id}
                  className="border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        isGraded
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-amber-500/15 text-amber-400'
                      )}
                    >
                      #{s.attemptNumber}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {isGraded ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Đã chấm
                          </>
                        ) : (
                          <>
                            <Clock className="h-3.5 w-3.5 text-amber-400" /> Chờ giáo viên chấm
                          </>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Nộp lúc {fmtTime(s.submittedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {isGraded && s.score !== null && (
                      <span className="text-sm font-bold text-emerald-400 tabular-nums">
                        {s.score}
                        {s.maxScore ? ` / ${s.maxScore}` : ''}
                      </span>
                    )}
                    {url && (
                      <a
                        href={url}
                        download
                        className="text-muted-foreground hover:text-primary text-xs"
                      >
                        Tải file
                      </a>
                    )}
                  </div>
                  {s.feedback && (
                    <p className="text-muted-foreground border-border/40 mt-1 w-full border-t pt-2 text-xs whitespace-pre-wrap">
                      <span className="text-foreground font-semibold">Nhận xét:</span> {s.feedback}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
