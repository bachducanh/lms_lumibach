'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

type Props = {
  /** Chặn dán nội dung từ NGOÀI vào ô trả lời. Dán lại thứ vừa chép trong bài vẫn được. */
  blockPaste: boolean;
  /** Dòng in chìm lên đề (họ tên · tên đăng nhập). null = không in chìm. */
  watermark: string | null;
  children: ReactNode;
};

/**
 * Chống sao chép đề khi làm quiz — chạy được trên cả điện thoại lẫn máy tính.
 *
 * Chặn bôi đen, sao chép, chuột phải / nhấn giữ, kéo thả và in TRÊN NỘI DUNG ĐỀ.
 * Trong ô trả lời (input, ô tự luận TipTap, ô code Monaco) vẫn chép/dán bình
 * thường để học sinh sửa bài được; tuỳ chọn chặn dán chỉ chặn nội dung lấy từ
 * ngoài vào.
 *
 * Trang web KHÔNG chặn được việc chụp màn hình (phím cứng điện thoại, PrintScreen
 * đều do hệ điều hành xử lý). Dấu chìm họ tên + giờ lặp khắp đề là cách răn đe
 * thay thế: ảnh lọt ra ngoài là biết của ai. Học sinh thạo máy vẫn lách được
 * phần chặn sao chép (công cụ nhà phát triển…) — đây là rào cản, không phải khoá.
 */
export function ExamShield({ blockPaste, watermark, children }: Props) {
  // Những đoạn học sinh vừa chép TRONG ô trả lời — dán lại chúng thì không chặn.
  const internalCopies = useRef<string[]>([]);

  useEffect(() => {
    const warn = (message: string) => toast.warning(message, { id: 'exam-shield' });

    const remember = (text: string) => {
      const key = normalize(text);
      if (!key) return;
      internalCopies.current = [key, ...internalCopies.current.filter((t) => t !== key)].slice(
        0,
        20
      );
    };

    const onCopyCapture = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      warn('Bài kiểm tra này không cho sao chép nội dung đề.');
    };
    // Pha nổi bọt: chạy SAU trình soạn thảo, lúc Monaco đã tự ghi dữ liệu vào
    // clipboardData. Input / TipTap để trình duyệt tự chép nên đọc vùng chọn.
    const onCopyBubble = (e: ClipboardEvent) => {
      if (!isEditable(e.target)) return;
      remember(e.clipboardData?.getData('text/plain') || selectedText(e.target));
    };

    const onPaste = (e: ClipboardEvent) => {
      if (!blockPaste || !isEditable(e.target)) return;
      const data = e.clipboardData;
      const text = data?.getData('text/plain') ?? '';
      const hasFiles = (data?.files.length ?? 0) > 0;
      if (!hasFiles && (text === '' || internalCopies.current.includes(normalize(text)))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      warn('Không được dán nội dung từ bên ngoài vào bài làm.');
    };

    const onContextMenu = (e: MouseEvent) => {
      // Menu chuột phải riêng của Monaco có nút "Dán" đọc thẳng clipboard, không
      // qua sự kiện paste — chặn dán thì phải chặn luôn menu này.
      const inMonaco = closest(e.target, '.monaco-editor');
      if (isEditable(e.target) && !(blockPaste && inMonaco)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    const onDragStart = (e: DragEvent) => {
      if (isEditable(e.target)) return;
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!blockPaste || !isEditable(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      warn('Không được kéo thả nội dung từ bên ngoài vào bài làm.');
    };

    const onSelectStart = (e: Event) => {
      if (!isEditable(e.target)) e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      // In, lưu trang, xem mã nguồn: đều là đường lấy trọn đề ra ngoài.
      if (key === 'p' || key === 's' || key === 'u') {
        e.preventDefault();
        warn('Bài kiểm tra này không cho in hoặc lưu đề.');
      } else if (key === 'a' && !isEditable(e.target)) {
        e.preventDefault();
      }
    };

    document.addEventListener('copy', onCopyCapture, true);
    document.addEventListener('cut', onCopyCapture, true);
    document.addEventListener('copy', onCopyBubble);
    document.addEventListener('cut', onCopyBubble);
    document.addEventListener('paste', onPaste, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('drop', onDrop, true);
    document.addEventListener('selectstart', onSelectStart, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('copy', onCopyCapture, true);
      document.removeEventListener('cut', onCopyCapture, true);
      document.removeEventListener('copy', onCopyBubble);
      document.removeEventListener('cut', onCopyBubble);
      document.removeEventListener('paste', onPaste, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('drop', onDrop, true);
      document.removeEventListener('selectstart', onSelectStart, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [blockPaste]);

  return (
    <div className="exam-shield relative">
      {/* Bôi đen bị tắt trên đề nhưng phải bật lại trong ô trả lời. Nhấn giữ trên
          iPhone/iPad không hiện menu "Sao chép / Tra cứu" nhờ touch-callout. In
          trang thì đề bị ẩn. */}
      <style>{`
        .exam-shield { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
        .exam-shield input, .exam-shield textarea, .exam-shield [contenteditable="true"],
        .exam-shield [contenteditable="true"] *, .exam-shield .monaco-editor,
        .exam-shield .monaco-editor * { -webkit-user-select: text; user-select: text; }
        .exam-shield img { -webkit-user-drag: none; }
        @media print {
          .exam-shield { display: none !important; }
          body::after { content: 'Bài kiểm tra này không cho in.'; font-size: 16px; }
        }
      `}</style>
      {children}
      {watermark && <Watermark text={watermark} />}
    </div>
  );
}

/** Dòng in chìm lặp chéo khắp màn hình, kèm giờ hiện tại (đổi mỗi 30 giây). */
function Watermark({ text }: { text: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return null;

  const stamp = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    hour12: false,
  }).format(now);
  const line = `${text} · ${stamp}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="190">` +
    `<text x="10" y="120" transform="rotate(-24 180 95)" font-family="sans-serif" ` +
    `font-size="15" font-weight="600" fill="rgb(128,128,128)" fill-opacity="0.2">` +
    `${escapeXml(line)}</text></svg>`;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 select-none"
      style={{ backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")` }}
    />
  );
}

function closest(target: EventTarget | null, selector: string): Element | null {
  return target instanceof Element ? target.closest(selector) : null;
}

/** Ô trả lời: input chữ, textarea, ô tự luận (contenteditable), ô code Monaco. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
      target.type
    );
  }
  return (
    (target instanceof HTMLElement && target.isContentEditable) ||
    !!target.closest('.monaco-editor')
  );
}

function selectedText(target: EventTarget | null): string {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const { selectionStart: start, selectionEnd: end, value } = target;
    return start !== null && end !== null ? value.slice(start, end) : '';
  }
  return window.getSelection()?.toString() ?? '';
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
