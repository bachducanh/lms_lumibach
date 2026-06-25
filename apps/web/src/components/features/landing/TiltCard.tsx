'use client';

import { useRef, type ReactNode } from 'react';

/**
 * Bọc nội dung để tạo hiệu ứng nghiêng 3D theo con trỏ + đốm sáng (glare).
 * Truyền --rx/--ry (góc nghiêng) và --mx/--my (vị trí glare) qua CSS var,
 * tiêu thụ bởi class `.lb-tilt` trong globals.css. Tự bỏ qua khi reduced-motion.
 */
export function TiltCard({
  children,
  className,
  max = 5,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * max;
    const rotateX = -((y - rect.height / 2) / (rect.height / 2)) * max;
    el.style.setProperty('--rx', `${rotateX}deg`);
    el.style.setProperty('--ry', `${rotateY}deg`);
    el.style.setProperty('--mx', `${(x / rect.width) * 100}%`);
    el.style.setProperty('--my', `${(y / rect.height) * 100}%`);
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`lb-tilt h-full ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
