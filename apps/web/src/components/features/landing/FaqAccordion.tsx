'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Faq = { q: string; a: string };

/**
 * Danh sách câu hỏi thường gặp dạng accordion — các dòng ngăn bằng đường kẻ,
 * mở/đóng từng mục (mục đầu mở sẵn). Dùng grid-rows để mở mượt mà, và chỉ
 * animate khi người dùng không tắt chuyển động.
 */
export function FaqAccordion({ items }: { items: Faq[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="border-border divide-border divide-y border-y">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                id={`faq-trigger-${i}`}
                className="hover:text-primary flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold transition-colors sm:text-lg"
              >
                {item.q}
                <span
                  aria-hidden
                  className={cn(
                    'border-border flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                    isOpen && 'border-primary bg-primary text-primary-foreground'
                  )}
                >
                  <Plus
                    className={cn(
                      'h-4 w-4 motion-safe:transition-transform motion-safe:duration-200',
                      isOpen && 'rotate-45'
                    )}
                  />
                </span>
              </button>
            </h3>
            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-trigger-${i}`}
              className="grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="text-muted-foreground max-w-2xl pb-5 text-base leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
