'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  to: number;
  duration?: number; // ms
  start?: number;
  className?: string;
};

/**
 * Animated number that counts from `start` to `to` once it enters the viewport.
 * Uses requestAnimationFrame so the rate is smooth on any refresh rate.
 */
export function CountUp({ to, duration = 1800, start = 0, className }: Props) {
  const [value, setValue] = useState(start);
  const [hasRun, setHasRun] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (hasRun) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setHasRun(true);

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) {
          setValue(to);
          return;
        }

        const startTime = performance.now();
        const startVal = start;
        const range = to - startVal;

        const step = (now: number) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / duration, 1);
          // easeOutCubic — fast start, slow finish
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(startVal + range * eased));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration, start, hasRun]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString('vi-VN')}
    </span>
  );
}
