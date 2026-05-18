'use client';

import { useEffect } from 'react';

/**
 * Sweeps the document for any `.lb-reveal` element and adds
 * `.is-revealed` the first time each one scrolls into view.
 * Mount this once per page (e.g. inside app/template.tsx) — it
 * watches its own mount lifecycle, so re-mounts on every route
 * navigation and picks up the new page's elements automatically.
 *
 * A MutationObserver also picks up elements added later by client
 * components (e.g. items loaded by scroll-then-fetch lists).
 */
export function ScrollRevealProvider() {
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            intersectionObserver.unobserve(entry.target);
          }
        }
      },
      {
        // Trigger when ~15% of the element is visible OR when it's
        // 80px into the viewport from the bottom — feels natural for
        // big cards and small badges alike.
        threshold: 0.15,
        rootMargin: '0px 0px -80px 0px',
      }
    );

    function observe(el: Element) {
      if (reduce) {
        el.classList.add('is-revealed');
        return;
      }
      // If the element starts already in view (e.g. very tall first
      // section), the IO will fire synchronously after observation.
      intersectionObserver.observe(el);
    }

    // Defer initial observation until React 19 has fully committed and
    // hydrated. Adding `.is-revealed` too early races hydration and
    // produces "tree hydrated but attributes didn't match" warnings.
    // 80ms is empirically safe — long enough for hydration even on
    // larger trees, short enough that users perceive entrance as
    // immediate.
    let timer: number | undefined;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        timer = window.setTimeout(() => {
          document.querySelectorAll<HTMLElement>('.lb-reveal:not(.is-revealed)').forEach(observe);
        }, 80);
      });
    });

    // Pick up anything React adds later.
    const mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('.lb-reveal:not(.is-revealed)')) observe(node);
          node.querySelectorAll?.('.lb-reveal:not(.is-revealed)').forEach(observe);
        });
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (timer !== undefined) clearTimeout(timer);
      intersectionObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}
