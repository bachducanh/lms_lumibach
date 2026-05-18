'use client';

import { useEffect, useRef } from 'react';

type Props = {
  /** Speed multiplier — 0.1 = slow / -0.2 = opposite direction. */
  speed?: number;
  /** Tailwind classes for sizing/colour. */
  className?: string;
  /** Inline background — usually a radial-gradient or solid colour. */
  style?: React.CSSProperties;
};

/**
 * A position:absolute decorative blob that shifts vertically with
 * page scroll, creating depth. Speed defaults to 0.15 (gentle).
 * Place inside a position:relative parent.
 */
export function ParallaxBlob({ speed = 0.15, className, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el) return;
        el.style.setProperty('--py', `${window.scrollY * speed}px`);
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed]);

  return <div ref={ref} aria-hidden className={`lb-parallax ${className ?? ''}`} style={style} />;
}
