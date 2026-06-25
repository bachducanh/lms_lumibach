'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

type Faq = { q: string; a: string };

/**
 * Danh sách câu hỏi thường gặp dạng accordion. Mở/đóng từng mục;
 * mục đầu mở sẵn. Dùng grid-rows trick để mở mượt mà.
 */
export function FaqAccordion({ items }: { items: Faq[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={`border-border bg-card overflow-hidden rounded-xl border transition-colors ${
              isOpen ? 'border-primary/40' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-semibold"
            >
              {item.q}
              <Plus
                className={`text-primary h-4 w-4 shrink-0 transition-transform duration-300 ${
                  isOpen ? 'rotate-45' : ''
                }`}
              />
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="text-muted-foreground px-4 pb-4 text-sm leading-relaxed">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
