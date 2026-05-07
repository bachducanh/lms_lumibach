'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Cat, Play, Maximize2, Minimize2 } from 'lucide-react';

type Props = {
  /** URL of the .sb3 starter project on MinIO. Falls back to blank Scratch project. */
  starterUrl?: string | null;
  /** If true, label as "open submission" (teacher reviewing student work). */
  playerOnly?: boolean;
  /**
   * Called when self-hosted scratch-gui posts an .sb3 save event back to the LMS.
   * If undefined, this feature is disabled.
   */
  onSaveBlob?: (blob: Blob, filename: string) => void;
};

/**
 * Two modes:
 *
 * 1. **Self-hosted (Phase B)** — if `/scratch-gui/index.html` exists (built by `pnpm build:scratch-gui`),
 *    we iframe it directly. Same-origin, so the browser allows the iframe and we can use
 *    `postMessage` for true 1-click submit.
 *
 * 2. **Fallback** — if the self-hosted bundle isn't built, show a button that opens
 *    TurboWarp in a new tab. Student saves .sb3, drags into LMS upload zone.
 *
 * The component auto-detects which mode to use by HEAD-ing `/scratch-gui/index.html`.
 */
export function ScratchEditor({ starterUrl, playerOnly = false, onSaveBlob }: Props) {
  const [hasSelfHost, setHasSelfHost] = useState<boolean | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Detect self-hosted scratch-gui at /scratch-gui/embed.html
  useEffect(() => {
    let cancelled = false;
    fetch('/scratch-gui/embed.html', { method: 'HEAD' })
      .then((r) => { if (!cancelled) setHasSelfHost(r.ok); })
      .catch(() => { if (!cancelled) setHasSelfHost(false); });
    return () => { cancelled = true; };
  }, []);

  // Listen for postMessage from self-hosted iframe (Phase B 1-click submit)
  useEffect(() => {
    if (!onSaveBlob) return;
    const cb: (blob: Blob, filename: string) => void = onSaveBlob;
    function onMessage(event: MessageEvent) {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; filename?: string; sb3?: ArrayBuffer };
      if (data?.type !== 'lumibach:scratch-save' || !data.sb3) return;
      const blob = new Blob([data.sb3], { type: 'application/x.scratch.sb3' });
      cb(blob, data.filename ?? 'project.sb3');
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSaveBlob]);

  // Fullscreen — block body scroll while open
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [fullscreen]);

  // While probing
  if (hasSelfHost === null) {
    return (
      <div className="rounded-xl border border-border bg-card h-32 flex items-center justify-center text-sm text-muted-foreground">
        Đang chuẩn bị Scratch Editor...
      </div>
    );
  }

  // ── Mode 1: Self-hosted iframe (Phase B) ───────────────────

  if (hasSelfHost) {
    const params = new URLSearchParams();
    if (starterUrl) params.set('project_url', starterUrl);
    // Disable TurboWarp's JIT compiler — runs scripts in interpreter mode instead.
    // Avoids noisy "Cannot find top block" errors triggered by the compiler's
    // incremental recompile while the user is mid-edit. Tradeoff: slightly slower
    // scripts, but rock-solid block editing UX (matches stock Scratch behavior).
    params.set('nocompile', '1');
    const iframeSrc = `/scratch-gui/editor.html?${params.toString()}`;

    return (
      <div
        className={fullscreen
          ? 'fixed inset-0 z-50 bg-black flex flex-col'
          : 'relative rounded-xl border border-border overflow-hidden bg-black'
        }
      >
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-1.5 text-xs">
          <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
            <Cat className="h-3 w-3 text-orange-400" />
            Scratch Editor (LumiBach)
          </span>
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted transition-colors"
            title={fullscreen ? 'Thu nhỏ (Esc)' : 'Toàn màn hình'}
          >
            {fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            {fullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          </button>
        </div>
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Scratch Editor"
          allow="autoplay; clipboard-read; clipboard-write; fullscreen; gamepad; microphone; camera"
          style={{
            width: '100%',
            height: fullscreen ? 'calc(100vh - 32px)' : '640px',
            border: 'none',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // ── Mode 2: Fallback — open TurboWarp in new tab ───────────

  const params = new URLSearchParams();
  if (starterUrl) params.set('project_url', starterUrl);
  const url = `https://turbowarp.org/editor${params.toString() ? '?' + params.toString() : ''}`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        className="relative px-6 py-8 border-b border-border"
        style={{ background: 'linear-gradient(135deg, rgb(255 165 89 / 12%), rgb(155 85 215 / 8%))' }}
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
                ? 'Nhấn nút bên dưới để mở project Scratch của học sinh trong tab mới.'
                : starterUrl
                  ? 'Nhấn nút bên dưới để mở Scratch Editor với project khởi đầu đã được nạp sẵn.'
                  : 'Nhấn nút bên dưới để mở Scratch Editor (project trống).'}
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-2">
              💡 Mẹo: chạy <code className="font-mono text-orange-300">pnpm build:scratch-gui</code> để embed Scratch ngay trong LMS, không cần mở tab mới.
            </p>
          </div>
        </div>
      </div>
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
            Sau khi code xong, vào <strong className="text-foreground">File → Save to your computer</strong> để tải <code className="font-mono text-orange-300">.sb3</code>, rồi quay lại trang này để nộp.
          </p>
        )}
      </div>
    </div>
  );
}
