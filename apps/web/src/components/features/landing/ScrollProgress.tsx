'use client';

import { useEffect, useRef } from 'react';

/**
 * Thanh tiến độ cuộn mảnh ở đỉnh trang (gradient brand). Cập nhật scaleX qua
 * rAF cho mượt; bám transform nên không gây reflow.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const ratio = max > 0 ? Math.min(1, doc.scrollTop / max) : 0;
      el.style.transform = `scaleX(${ratio})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left scale-x-0"
      ref={ref}
      style={{
        background: 'linear-gradient(90deg, rgb(253 8 93), oklch(0.78 0.16 220))',
        boxShadow: '0 0 10px rgb(253 8 93 / 50%)',
      }}
    />
  );
}
