'use client';

import { useEffect, useRef } from 'react';

/**
 * Spotlight that follows the cursor across the parent section.
 * Drop inside a position:relative container as the first child.
 * Uses CSS variables --mx/--my consumed by the `.lb-mouse-glow` class.
 */
export function MouseGlow({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    let raf = 0;
    function onMove(e: MouseEvent) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!parent || !el) return;
        const rect = parent.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--mx', `${x}px`);
        el.style.setProperty('--my', `${y}px`);
      });
    }
    parent.addEventListener('mousemove', onMove);
    return () => {
      parent.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`lb-mouse-glow pointer-events-none absolute inset-0 ${className ?? ''}`}
    />
  );
}
