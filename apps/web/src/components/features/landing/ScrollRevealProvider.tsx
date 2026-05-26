'use client';

import { useEffect } from 'react';

const REVEAL_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const REVEAL_DISTANCE = '28px';
const CHILD_REVEAL_DISTANCE = '20px';
const REVEAL_DURATION_MS = 1100;
const CHILD_REVEAL_DURATION_MS = 900;
const CSS_INDEX_STAGGER_MS = 150;
const CHILD_STAGGER_MS = 80;

/**
 * Sweeps the document for any `.lb-reveal` element and plays an
 * entrance animation the first time each one scrolls into view.
 * Mount this once per page (e.g. inside app/template.tsx) — it
 * watches its own mount lifecycle, so re-mounts on every route
 * navigation and picks up the new page's elements automatically.
 *
 * A MutationObserver also picks up elements added later by client
 * components (e.g. items loaded by scroll-then-fetch lists).
 */
export function ScrollRevealProvider() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const observed = new WeakSet<Element>();
    const revealed = new WeakSet<Element>();

    function revealDelay(el: Element) {
      const cssIndex = Number.parseFloat(getComputedStyle(el).getPropertyValue('--i'));
      return Number.isFinite(cssIndex) ? cssIndex * CSS_INDEX_STAGGER_MS : 0;
    }

    function playReveal(el: HTMLElement) {
      if (revealed.has(el) || reduce) return;
      revealed.add(el);

      el.animate(
        [
          { opacity: 0, transform: `translateY(${REVEAL_DISTANCE})` },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        {
          delay: revealDelay(el),
          duration: REVEAL_DURATION_MS,
          easing: REVEAL_EASING,
          fill: 'backwards',
        }
      );

      if (!el.classList.contains('lb-reveal-children')) return;

      Array.from(el.children).forEach((child, index) => {
        if (!(child instanceof HTMLElement)) return;
        child.animate(
          [
            { opacity: 0, transform: `translateY(${CHILD_REVEAL_DISTANCE})` },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            delay: Math.min(index, 11) * CHILD_STAGGER_MS,
            duration: CHILD_REVEAL_DURATION_MS,
            easing: REVEAL_EASING,
            fill: 'backwards',
          }
        );
      });
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            playReveal(entry.target as HTMLElement);
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
      if (observed.has(el) || revealed.has(el)) return;
      if (reduce || el.classList.contains('is-revealed')) {
        revealed.add(el);
        return;
      }
      observed.add(el);
      intersectionObserver.observe(el);
    }

    const raf = requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('.lb-reveal').forEach(observe);
    });

    // Pick up anything React adds later.
    const mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('.lb-reveal')) observe(node);
          node.querySelectorAll?.('.lb-reveal').forEach(observe);
        });
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      intersectionObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}
