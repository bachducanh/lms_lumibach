'use client';

import { useRef, type ReactNode } from 'react';

/**
 * Bọc 1 phần tử (nút, link) để nó "hút" nhẹ theo con trỏ chuột.
 * Render span inline-block để không phá layout của child bên trong.
 */
export function Magnetic({
  children,
  className,
  strength = 0.25,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  function onMove(e: React.MouseEvent<HTMLSpanElement>) {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  }

  function reset() {
    const el = ref.current;
    if (el) el.style.transform = 'translate(0, 0)';
  }

  return (
    <span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`inline-block transition-transform duration-200 ease-out ${className ?? ''}`}
    >
      {children}
    </span>
  );
}
