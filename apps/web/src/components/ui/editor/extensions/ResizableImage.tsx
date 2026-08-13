'use client';

import { useRef, useState } from 'react';
import {
  mergeAttributes,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import ImageExt from '@tiptap/extension-image';
import { cn } from '@/lib/utils';

const MIN_WIDTH = 48;

/**
 * Ảnh trong editor, kéo được kích thước.
 *
 * Extension Image gốc chỉ lưu src/alt/title nên ảnh luôn hiện nguyên khổ.
 * Ở đây thêm thuộc tính `width` (px, ghi thẳng vào thẻ <img>) và một node view
 * có tay kéo ở hai góc dưới. Vì lưu bằng thuộc tính HTML chuẩn, nội dung cũ
 * không cần chuyển đổi và bản render read-only (RichTextView) tự hiểu — CSS
 * `max-width: 100%; height: auto` trong globals.css lo phần tràn khung.
 */
export const ResizableImage = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const attr = element.getAttribute('width');
          if (attr) return Number.parseInt(attr, 10) || null;
          // Nội dung dán từ nơi khác thường đặt kích thước trong style.
          const styleWidth = element.style.width;
          if (styleWidth?.endsWith('px')) return Number.parseInt(styleWidth, 10) || null;
          return null;
        },
        renderHTML: (attributes) => {
          const width = attributes.width as number | null;
          if (!width) return {};
          return { width: String(width), style: `width: ${width}px;` };
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

function ImageNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string | null) ?? '';
  const title = (node.attrs.title as string | null) ?? undefined;
  const width = node.attrs.width as number | null;
  const editable = editor.isEditable;

  function startResize(event: React.PointerEvent<HTMLButtonElement>, side: 'left' | 'right') {
    event.preventDefault();
    event.stopPropagation();
    const img = imgRef.current;
    if (!img) return;

    const startX = event.clientX;
    const startWidth = img.getBoundingClientRect().width;
    const maxWidth = img.parentElement?.parentElement?.getBoundingClientRect().width ?? Infinity;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);

    function onMove(moveEvent: PointerEvent) {
      const delta = (moveEvent.clientX - startX) * (side === 'right' ? 1 : -1);
      const next = Math.round(Math.min(Math.max(startWidth + delta, MIN_WIDTH), maxWidth));
      setDragWidth(next);
    }

    function onUp(upEvent: PointerEvent) {
      const delta = (upEvent.clientX - startX) * (side === 'right' ? 1 : -1);
      const next = Math.round(Math.min(Math.max(startWidth + delta, MIN_WIDTH), maxWidth));
      setDragWidth(null);
      updateAttributes({ width: next });
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
    }

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }

  function setPercent(percent: number) {
    const containerWidth =
      imgRef.current?.parentElement?.parentElement?.getBoundingClientRect().width;
    if (!containerWidth) return;
    updateAttributes({ width: Math.round((containerWidth * percent) / 100) });
  }

  const shownWidth = dragWidth ?? width ?? undefined;

  return (
    <NodeViewWrapper className="relative my-3 leading-none" data-drag-handle>
      <span className="group/image relative inline-block max-w-full">
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          title={title}
          width={shownWidth}
          style={shownWidth ? { width: `${shownWidth}px` } : undefined}
          className={cn(
            'block h-auto max-w-full rounded-md',
            selected && editable && 'ring-primary ring-2 ring-offset-2'
          )}
          draggable={false}
        />

        {editable && (
          <>
            <ResizeHandle side="left" onPointerDown={(e) => startResize(e, 'left')} />
            <ResizeHandle side="right" onPointerDown={(e) => startResize(e, 'right')} />

            {(selected || dragWidth !== null) && (
              <span className="bg-foreground text-background absolute top-1 left-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium">
                {dragWidth !== null ? (
                  `${dragWidth}px`
                ) : (
                  <>
                    {[25, 50, 75, 100].map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="hover:text-primary px-0.5"
                        onClick={() => setPercent(p)}
                        title={`Rộng ${p}%`}
                      >
                        {p}%
                      </button>
                    ))}
                    <button
                      type="button"
                      className="hover:text-primary px-0.5"
                      onClick={() => updateAttributes({ width: null })}
                      title="Kích thước gốc"
                    >
                      gốc
                    </button>
                  </>
                )}
              </span>
            )}
          </>
        )}
      </span>
    </NodeViewWrapper>
  );
}

function ResizeHandle({
  side,
  onPointerDown,
}: {
  side: 'left' | 'right';
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? 'Kéo để thu/phóng từ trái' : 'Kéo để thu/phóng từ phải'}
      onPointerDown={onPointerDown}
      className={cn(
        'border-background bg-primary absolute top-1/2 h-6 w-2.5 -translate-y-1/2 cursor-ew-resize',
        'rounded-full border opacity-0 transition-opacity',
        'group-hover/image:opacity-100 focus-visible:opacity-100',
        side === 'left' ? '-left-1' : '-right-1'
      )}
    />
  );
}
