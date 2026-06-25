'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ParticleField } from './ParticleField';

/**
 * Nền "nebula" toàn trang (lưới + hạt + gradient navy ở dark mode).
 *
 * Portal thẳng vào document.body để THOÁT khỏi wrapper `.lb-page-enter`
 * (template.tsx) — wrapper này giữ `transform` sau animation, tạo containing
 * block khiến phần tử `position: fixed` bên trong bị kéo cao bằng cả trang thay
 * vì viewport (làm hạt particle rải mỏng gần như biến mất). Ở body, `fixed`
 * neo đúng theo viewport.
 */
export function NebulaBackground() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="lb-nebula pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Tech grid — mờ dần xuống dưới */}
      <svg
        className="text-foreground absolute inset-0 h-full w-full [mask-image:linear-gradient(to_bottom,black,transparent_80%)] opacity-[0.045] [-webkit-mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <pattern id="page-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#page-grid)" />
      </svg>
      {/* Particle constellation across the viewport */}
      <ParticleField />
    </div>,
    document.body
  );
}
