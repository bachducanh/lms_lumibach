'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ScratchEditor } from './ScratchEditor';
import { Sb3Upload } from './Sb3Upload';
import { submitScratchAction } from '@/actions/scratch';
import { Send, Info, History, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Submission = {
  id:            string;
  status:        string;
  score:         number | null;
  maxScore:      number | null;
  feedback:      string | null;
  submittedAt:   Date;
  attemptNumber: number;
  code:          string;
  gradedAt:      Date | null;
};

type Props = {
  exerciseId:  string;
  starterUrl:  string | null;
  initialSubs: Submission[];
};

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

function parseSb3Url(code: string): string | null {
  try { return (JSON.parse(code) as { sb3Url?: string }).sb3Url ?? null; }
  catch { return null; }
}

export function ScratchTakePanel({ exerciseId, starterUrl, initialSubs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingUrl, setPendingUrl]   = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [subs, setSubs] = useState<Submission[]>(initialSubs);

  function handleSubmit() {
    if (!pendingUrl) {
      toast.error('Hãy tải file .sb3 lên trước khi nộp bài.');
      return;
    }
    startTransition(async () => {
      const res = await submitScratchAction({
        exerciseId,
        sb3Url:   pendingUrl,
        filename: pendingName ?? undefined,
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success(res.message ?? 'Đã nộp bài.');
      setPendingUrl(null);
      setPendingName(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Instructions banner */}
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-3 flex gap-3 text-sm">
        <Info className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="font-semibold text-orange-300">Hướng dẫn 3 bước</p>
          <ol className="list-decimal list-inside text-xs space-y-1 text-muted-foreground">
            <li>Bấm <strong className="text-foreground">Mở Scratch Editor</strong> ở khung bên dưới — Scratch sẽ mở trong tab mới với project khởi đầu (nếu giáo viên đã cung cấp).</li>
            <li>Lập trình xong, trong Scratch vào menu <strong className="text-foreground">File → Save to your computer</strong> để tải file <code className="font-mono text-orange-300">.sb3</code> về máy.</li>
            <li>Quay lại trang này, kéo file <code className="font-mono text-orange-300">.sb3</code> vào ô <strong className="text-foreground">Nộp bài</strong> bên dưới rồi bấm <strong className="text-foreground">Nộp bài</strong>.</li>
          </ol>
        </div>
      </div>

      {/* Scratch editor (opens TurboWarp in new tab) */}
      <ScratchEditor starterUrl={starterUrl} />

      {/* Submission area */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Nộp bài</h3>
          {subs.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Lần thứ {subs[0]!.attemptNumber + 1}
            </span>
          )}
        </div>

        <Sb3Upload
          kind="submission"
          exerciseId={exerciseId}
          onUploaded={(url, name) => { setPendingUrl(url || null); setPendingName(name || null); }}
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

      {/* My submission history */}
      {subs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Lịch sử nộp bài ({subs.length})
          </h3>
          <div className="space-y-2">
            {subs.map((s) => {
              const url = parseSb3Url(s.code);
              const isGraded = !!s.gradedAt;
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      isGraded ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400',
                    )}>
                      #{s.attemptNumber}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium flex items-center gap-2">
                        {isGraded ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Đã chấm</>
                        ) : (
                          <><Clock className="h-3.5 w-3.5 text-amber-400" /> Chờ giáo viên chấm</>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nộp lúc {fmtTime(s.submittedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {isGraded && s.score !== null && (
                      <span className="text-sm font-bold text-emerald-400 tabular-nums">
                        {s.score}{s.maxScore ? ` / ${s.maxScore}` : ''}
                      </span>
                    )}
                    {url && (
                      <a
                        href={url}
                        download
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        Tải file
                      </a>
                    )}
                  </div>
                  {s.feedback && (
                    <p className="w-full text-xs text-muted-foreground border-t border-border/40 pt-2 mt-1 whitespace-pre-wrap">
                      <span className="font-semibold text-foreground">Nhận xét:</span> {s.feedback}
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
