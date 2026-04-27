'use client';

import { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Youtube from '@tiptap/extension-youtube';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import ImageExt from '@tiptap/extension-image';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Minus,
  Link as LinkIcon, Undo, Redo, PlaySquare,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Table, ImagePlus, Columns2, Rows2, Trash2,
  ChevronDown, Upload, Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Preset palettes ──────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { value: null,      label: 'Màu mặc định' },
  { value: '#000000', label: 'Đen' },
  { value: '#374151', label: 'Xám đậm' },
  { value: '#6b7280', label: 'Xám' },
  { value: '#dc2626', label: 'Đỏ' },
  { value: '#ea580c', label: 'Cam' },
  { value: '#ca8a04', label: 'Vàng' },
  { value: '#16a34a', label: 'Xanh lá' },
  { value: '#2563eb', label: 'Xanh dương' },
  { value: '#7c3aed', label: 'Tím' },
  { value: '#db2777', label: 'Hồng' },
  { value: '#0e7490', label: 'Xanh ngọc' },
];

const HIGHLIGHT_COLORS = [
  { value: null,      label: 'Xóa nền' },
  { value: '#fef9c3', label: 'Vàng nhạt' },
  { value: '#fed7aa', label: 'Cam nhạt' },
  { value: '#fecaca', label: 'Đỏ nhạt' },
  { value: '#bbf7d0', label: 'Xanh lá nhạt' },
  { value: '#bfdbfe', label: 'Xanh dương nhạt' },
  { value: '#e9d5ff', label: 'Tím nhạt' },
  { value: '#fce7f3', label: 'Hồng nhạt' },
  { value: '#d1d5db', label: 'Xám nhạt' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
}

// ─── Toolbar primitives ───────────────────────────────────────────────────────

type TBtnProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
};

function TBtn({ onClick, active, disabled, title, children, className }: TBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex h-7 min-w-7 items-center justify-center rounded px-1 text-sm transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'pointer-events-none opacity-35',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

// ─── Dropdown (closes on outside click) ──────────────────────────────────────

function Dropdown({ trigger, children, align = 'left' }: {
  trigger: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger(open)}</div>
      {open && (
        <div className={cn(
          'absolute top-full z-50 mt-1 rounded-lg border border-border bg-background shadow-lg',
          align === 'right' ? 'right-0' : 'left-0',
        )}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ─── Color picker ────────────────────────────────────────────────────────────

function ColorPicker({
  colors,
  onSelect,
  title,
  icon,
  activeColor,
}: {
  colors: { value: string | null; label: string }[];
  onSelect: (value: string | null) => void;
  title: string;
  icon: React.ReactNode;
  activeColor?: string | null;
}) {
  return (
    <Dropdown
      trigger={(open) => (
        <button
          type="button"
          title={title}
          className={cn(
            'flex h-7 w-8 flex-col items-center justify-center rounded transition-colors',
            open ? 'bg-muted' : 'hover:bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          {icon}
          <div
            className="mt-0.5 h-1 w-4 rounded-sm"
            style={{ background: activeColor ?? 'transparent', border: activeColor ? 'none' : '1px dashed currentColor' }}
          />
        </button>
      )}
    >
      {(close) => (
        <div className="grid grid-cols-4 gap-1 p-2 w-36">
          {colors.map((c) => (
            <button
              key={c.value ?? 'none'}
              type="button"
              title={c.label}
              onClick={() => { onSelect(c.value); close(); }}
              className={cn(
                'h-6 w-6 rounded border border-border transition-transform hover:scale-110',
                c.value === null && 'flex items-center justify-center text-xs text-muted-foreground',
              )}
              style={c.value ? { background: c.value } : { background: 'white' }}
            >
              {c.value === null ? '✕' : null}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

// ─── Table menu ───────────────────────────────────────────────────────────────

function TableMenu({ editor }: { editor: Editor }) {
  const inTable = editor.isActive('table');

  return (
    <Dropdown
      trigger={(open) => (
        <button
          type="button"
          title="Bảng"
          className={cn(
            'flex h-7 items-center gap-0.5 rounded px-1.5 text-sm transition-colors',
            inTable
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            open && 'bg-muted',
          )}
        >
          <Table className="h-4 w-4" />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      )}
    >
      {(close) => (
        <div className="min-w-44 py-1 text-sm">
          {!inTable && (
            <MenuItem
              onClick={() => {
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                close();
              }}
              icon={<Table className="h-3.5 w-3.5" />}
            >
              Chèn bảng 3×3
            </MenuItem>
          )}
          {inTable && (
            <>
              <MenuLabel>Hàng</MenuLabel>
              <MenuItem onClick={() => { editor.chain().focus().addRowBefore().run(); close(); }} icon={<Rows2 className="h-3.5 w-3.5" />}>
                Thêm hàng bên trên
              </MenuItem>
              <MenuItem onClick={() => { editor.chain().focus().addRowAfter().run(); close(); }} icon={<Rows2 className="h-3.5 w-3.5" />}>
                Thêm hàng bên dưới
              </MenuItem>
              <MenuItem onClick={() => { editor.chain().focus().deleteRow().run(); close(); }} icon={<Trash2 className="h-3.5 w-3.5" />} danger>
                Xóa hàng
              </MenuItem>
              <div className="my-1 border-t border-border" />
              <MenuLabel>Cột</MenuLabel>
              <MenuItem onClick={() => { editor.chain().focus().addColumnBefore().run(); close(); }} icon={<Columns2 className="h-3.5 w-3.5" />}>
                Thêm cột bên trái
              </MenuItem>
              <MenuItem onClick={() => { editor.chain().focus().addColumnAfter().run(); close(); }} icon={<Columns2 className="h-3.5 w-3.5" />}>
                Thêm cột bên phải
              </MenuItem>
              <MenuItem onClick={() => { editor.chain().focus().deleteColumn().run(); close(); }} icon={<Trash2 className="h-3.5 w-3.5" />} danger>
                Xóa cột
              </MenuItem>
              <div className="my-1 border-t border-border" />
              <MenuItem onClick={() => { editor.chain().focus().deleteTable().run(); close(); }} icon={<Trash2 className="h-3.5 w-3.5" />} danger>
                Xóa toàn bộ bảng
              </MenuItem>
            </>
          )}
        </div>
      )}
    </Dropdown>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-0.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{children}</div>;
}

function MenuItem({ onClick, icon, children, danger }: {
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-muted',
        danger ? 'text-destructive' : 'text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  stickyToolbarOffset?: number;
  compact?: boolean;
};

export function RichTextEditor({
  content = '',
  onChange,
  placeholder = 'Nhập nội dung...',
  className,
  editable = true,
  stickyToolbarOffset = 0,
  compact = false,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'not-prose rounded-md bg-muted p-4 font-mono text-sm' } },
        link: { openOnClick: false, HTMLAttributes: { class: 'text-primary underline cursor-pointer' } },
      }),
      Placeholder.configure({ placeholder }),
      Youtube.configure({ width: 640, height: 480, nocookie: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TableKit.configure({ table: { resizable: false } }),
      ImageExt.configure({ HTMLAttributes: { class: 'rounded-md max-w-full' } }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: !editable
          ? 'prose prose-sm max-w-none focus:outline-none px-0 py-0 text-sm leading-relaxed'
          : compact
            ? 'prose prose-sm max-w-none focus:outline-none min-h-[160px] px-4 py-3 text-sm leading-relaxed'
            : 'prose prose-sm max-w-none focus:outline-none min-h-[460px] px-6 py-5 text-[15px] leading-relaxed',
      },
    },
  });

  if (!editor) return null;

  // Capture narrowed editor for use inside function declaration bodies
  const ed = editor;
  const wordCount = countWords(ed.getHTML());

  function handleSetLink() {
    const prev = ed.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL liên kết:', prev ?? '');
    if (url === null) return;
    if (!url) { ed.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  function handleInsertYoutube() {
    const url = window.prompt('URL video YouTube:');
    if (url) ed.commands.setYoutubeVideo({ src: url });
  }

  function handleInsertImage() {
    const url = window.prompt('URL hình ảnh:');
    if (url) ed.chain().focus().setImage({ src: url }).run();
  }

  async function handleImageFileUpload(file: File) {
    setImageUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload/editor-image', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) ed.chain().focus().setImage({ src: data.url }).run();
      else alert(data.error ?? 'Upload thất bại');
    } catch {
      alert('Upload thất bại');
    } finally {
      setImageUploading(false);
    }
  }

  // read-only view
  if (!editable) {
    return (
      <div className={cn('prose prose-sm max-w-none [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold', className)}>
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-input bg-background shadow-sm', className)}>
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div
        className="sticky z-10 rounded-t-xl border-b border-input bg-background"
        style={{ top: stickyToolbarOffset }}
      >
        {/* Row 1 */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
          {/* Undo / Redo */}
          <TBtn title="Hoàn tác (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo className="h-4 w-4" />
          </TBtn>
          <TBtn title="Làm lại (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo className="h-4 w-4" />
          </TBtn>

          <Sep />

          {/* Headings */}
          <TBtn title="Tiêu đề lớn (H1)" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
            <Heading1 className="h-4 w-4" />
          </TBtn>
          <TBtn title="Tiêu đề vừa (H2)" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
            <Heading2 className="h-4 w-4" />
          </TBtn>
          <TBtn title="Tiêu đề nhỏ (H3)" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
            <Heading3 className="h-4 w-4" />
          </TBtn>

          <Sep />

          {/* Inline marks */}
          <TBtn title="In đậm (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
            <Bold className="h-4 w-4" />
          </TBtn>
          <TBtn title="In nghiêng (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
            <Italic className="h-4 w-4" />
          </TBtn>
          <TBtn title="Gạch chân (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
            <UnderlineIcon className="h-4 w-4" />
          </TBtn>
          <TBtn title="Gạch ngang" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
            <Strikethrough className="h-4 w-4" />
          </TBtn>
          <TBtn title="Chỉ số dưới (H₂O)" onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')}>
            <SubscriptIcon className="h-4 w-4" />
          </TBtn>
          <TBtn title="Chỉ số trên (x²)" onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')}>
            <SuperscriptIcon className="h-4 w-4" />
          </TBtn>

          <Sep />

          {/* Colors */}
          <ColorPicker
            title="Màu chữ"
            icon={<span className="text-xs font-bold" style={{ color: (editor.getAttributes('textStyle').color as string | undefined) ?? 'currentColor' }}>A</span>}
            colors={TEXT_COLORS}
            activeColor={editor.getAttributes('textStyle').color as string | undefined}
            onSelect={(v) => v ? editor.chain().focus().setColor(v).run() : editor.chain().focus().unsetColor().run()}
          />
          <ColorPicker
            title="Màu nền chữ"
            icon={<Highlighter className="h-3.5 w-3.5" />}
            colors={HIGHLIGHT_COLORS}
            activeColor={editor.getAttributes('highlight').color as string | undefined}
            onSelect={(v) => v ? editor.chain().focus().setHighlight({ color: v }).run() : editor.chain().focus().unsetHighlight().run()}
          />

          <Sep />

          {/* Alignment */}
          <TBtn title="Căn trái" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
            <AlignLeft className="h-4 w-4" />
          </TBtn>
          <TBtn title="Căn giữa" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
            <AlignCenter className="h-4 w-4" />
          </TBtn>
          <TBtn title="Căn phải" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
            <AlignRight className="h-4 w-4" />
          </TBtn>
          <TBtn title="Căn đều" onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })}>
            <AlignJustify className="h-4 w-4" />
          </TBtn>
        </div>

        {/* Row 2 */}
        <div className="flex flex-wrap items-center gap-0.5 border-t border-input/60 px-2 py-1.5">
          {/* Lists */}
          <TBtn title="Danh sách chấm" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
            <List className="h-4 w-4" />
          </TBtn>
          <TBtn title="Danh sách số" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
            <ListOrdered className="h-4 w-4" />
          </TBtn>
          <TBtn title="Trích dẫn" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
            <Quote className="h-4 w-4" />
          </TBtn>

          <Sep />

          {/* Code */}
          <TBtn title="Code nội tuyến" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}>
            <Code className="h-4 w-4" />
          </TBtn>
          <TBtn title="Khối code" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}>
            <span className="font-mono text-[11px] font-bold">{'{}'}</span>
          </TBtn>
          <TBtn title="Đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="h-4 w-4" />
          </TBtn>

          <Sep />

          {/* Insert: link, image, youtube */}
          <TBtn title="Chèn / sửa liên kết" onClick={handleSetLink} active={editor.isActive('link')}>
            <LinkIcon className="h-4 w-4" />
          </TBtn>
          <Dropdown
            trigger={(open) => (
              <button
                type="button"
                title="Chèn hình ảnh"
                className={cn(
                  'flex h-7 items-center gap-0.5 rounded px-1.5 text-sm transition-colors',
                  imageUploading ? 'cursor-wait opacity-50' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  open && 'bg-muted text-foreground',
                )}
              >
                <ImagePlus className="h-4 w-4" />
              </button>
            )}
          >
            {(close) => (
              <div className="min-w-40 py-1 text-sm">
                <MenuItem
                  onClick={() => { imageInputRef.current?.click(); close(); }}
                  icon={<Upload className="h-3.5 w-3.5" />}
                >
                  {imageUploading ? 'Đang upload...' : 'Từ máy tính'}
                </MenuItem>
                <MenuItem
                  onClick={() => { handleInsertImage(); close(); }}
                  icon={<Link2 className="h-3.5 w-3.5" />}
                >
                  Nhập URL
                </MenuItem>
              </div>
            )}
          </Dropdown>
          <TBtn title="Nhúng video YouTube" onClick={handleInsertYoutube}>
            <PlaySquare className="h-4 w-4" />
          </TBtn>

          <Sep />

          {/* Table */}
          <TableMenu editor={editor} />
        </div>
      </div>

      {/* ── Hidden image file input ──────────────────────────── */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFileUpload(file);
          e.target.value = '';
        }}
      />

      {/* ── Editor content ───────────────────────────────────── */}
      <EditorContent editor={editor} />

      {/* ── Status bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-b-xl border-t border-input bg-muted/20 px-4 py-1.5">
        <span className="text-xs text-muted-foreground">
          {editor.isActive('table') ? 'Đang chỉnh bảng — dùng Tab để di chuyển ô' : ''}
        </span>
        <span className="text-xs text-muted-foreground">
          {wordCount.toLocaleString('vi-VN')} từ
        </span>
      </div>
    </div>
  );
}
