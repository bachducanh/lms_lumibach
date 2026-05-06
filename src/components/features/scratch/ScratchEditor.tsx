'use client';

import { ExternalLink, Cat, Play } from 'lucide-react';

type Props = {
  /** URL of the .sb3 starter project on MinIO. Falls back to blank Scratch project. */
  starterUrl?: string | null;
  /** If true, label as "open submission" (teacher reviewing student work). */
  playerOnly?: boolean;
};

/**
 * Opens TurboWarp's editor in a new tab — embedded iframe is blocked by TurboWarp.
 *
 * The TurboWarp editor accepts `?project_url=<URL>` to auto-load a project from
 * any public URL. We pass the .sb3 URL on MinIO so students start with the teacher's
 * starter project, and teachers can review student submissions in the editor.
 *
 * To get true 1-click submit (in-LMS editor with no tab switching), we need to
 * self-host scratch-gui — see TODO Phase 3 / Scratch self-host.
 */
export function ScratchEditor({ starterUrl, playerOnly = false }: Props) {
  const params = new URLSearchParams();
  if (starterUrl) params.set('project_url', starterUrl);
  const url = `https://turbowarp.org/editor${params.toString() ? '?' + params.toString() : ''}`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Decorative header */}
      <div
        className="relative px-6 py-8 border-b border-border"
        style={{
          background: 'linear-gradient(135deg, rgb(255 165 89 / 12%), rgb(155 85 215 / 8%))',
        }}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <pattern id="scratch-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#scratch-grid)" />
          </svg>
        </div>

        <div className="relative flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 border border-orange-500/30">
            <Cat className="h-7 w-7 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
              Scratch Editor (TurboWarp)
            </p>
            <h3 className="text-lg font-bold">
              {playerOnly ? 'Mở project trong tab mới' : 'Bắt đầu lập trình'}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              {playerOnly
                ? 'Nhấn nút bên dưới để mở project Scratch của học sinh trong tab mới — bạn có thể chạy thử và xem block.'
                : starterUrl
                  ? 'Nhấn nút bên dưới để mở Scratch Editor với project khởi đầu của giáo viên đã được nạp sẵn.'
                  : 'Nhấn nút bên dưới để mở Scratch Editor (project trống — tự tạo từ đầu).'}
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 py-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, #ff8d2a, #f55b3c)',
            boxShadow: '0 4px 24px rgb(255 141 42 / 35%)',
          }}
        >
          {playerOnly ? <Play className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
          {playerOnly ? 'Mở project (tab mới)' : 'Mở Scratch Editor (tab mới)'}
        </a>

        {!playerOnly && (
          <p className="text-xs text-muted-foreground sm:max-w-md leading-relaxed">
            Sau khi code xong, trong Scratch chọn <strong className="text-foreground">File → Save to your computer</strong> để tải file <code className="font-mono text-orange-300">.sb3</code> về máy, rồi quay lại trang này để nộp.
          </p>
        )}
      </div>
    </div>
  );
}
