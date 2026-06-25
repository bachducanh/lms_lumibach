'use client';

import { useEffect, useState } from 'react';

/**
 * Hiệu ứng gõ chữ lặp qua danh sách câu. Có con trỏ nhấp nháy.
 * Reduced-motion: hiển thị tĩnh câu đầu tiên.
 */
export function Typewriter({
  phrases,
  className,
  typeMs = 55,
  deleteMs = 28,
  holdMs = 1200,
}: {
  phrases: string[];
  className?: string;
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
}) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(phrases[0] ?? '');
      return;
    }
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const loop = () => {
      const phrase = phrases[phraseIndex] ?? '';
      setText(phrase.slice(0, charIndex));
      if (!deleting && charIndex < phrase.length) {
        charIndex++;
        timer = setTimeout(loop, typeMs);
      } else if (!deleting && charIndex === phrase.length) {
        deleting = true;
        timer = setTimeout(loop, holdMs);
      } else if (deleting && charIndex > 0) {
        charIndex--;
        timer = setTimeout(loop, deleteMs);
      } else {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        timer = setTimeout(loop, 220);
      }
    };
    loop();
    return () => clearTimeout(timer);
  }, [phrases, typeMs, deleteMs, holdMs]);

  return (
    <span className={className}>
      {text}
      <span className="lb-caret" aria-hidden>
        ▋
      </span>
    </span>
  );
}
