'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileUp,
  FolderOpen,
  FolderPlus,
  HelpCircle,
  ListTree,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BulkDeleteQuestionsResult,
  CategoryQuestionBankData,
  CategoryWithQuestions,
  QuestionItem,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { OptionContent } from '@/components/features/quiz/OptionContent';
import { DeleteQuestionButton } from '@/components/features/quiz/DeleteQuestionButton';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { cn, stripHtml } from '@/lib/utils';
import {
  QUESTION_TYPE_BADGE as TYPE_BADGE,
  QUESTION_TYPE_SHORT as TYPE_SHORT,
  QUESTION_TYPE_ICON as TYPE_ICON,
} from '@/lib/question-type-labels';

const BAN_SAO_GIU_NGUYEN = 'Các bản đã chép về khoá học vẫn giữ nguyên — chúng là bản sao riêng.';

const CHUA_XEP = '__chua-xep__';

function loiCua(err: unknown, mac_dinh: string) {
  return err instanceof ApiError ? err.message : mac_dinh;
}

/**
 * Quiz mẫu của ngân hàng nội dung trỏ thẳng vào câu của kho (lớp học thì nhận
 * bản sao, không bị ảnh hưởng). Xoá câu là quiz mẫu mất câu đó — phải nói trước.
 */
function canhBaoQuizMau(cacCau: QuestionItem[]): string {
  const n = cacCau.filter((q) => (q.quizCount ?? 0) > 0).length;
  if (n === 0) return '';
  if (cacCau.length === 1) {
    return ' Lưu ý: câu này đang nằm trong quiz mẫu của ngân hàng nội dung — xoá đi thì quiz mẫu mất câu này.';
  }
  return n === 1
    ? ' Lưu ý: có 1 câu đang nằm trong quiz mẫu của ngân hàng nội dung — xoá đi thì quiz mẫu mất câu đó.'
    : ` Lưu ý: ${n} câu đang nằm trong quiz mẫu của ngân hàng nội dung — xoá đi thì các quiz mẫu đó mất những câu này.`;
}

// ── Chọn nhiều câu ────────────────────────────────────────────

type BoChon = {
  daChon: (id: string) => boolean;
  dao: (id: string) => void;
  datNhieu: (ids: string[], chon: boolean) => void;
};

function HopChon({
  checked,
  indeterminate = false,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // `indeterminate` không có thuộc tính HTML tương ứng, chỉ đặt được qua DOM.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      // Dòng câu hỏi bấm vào là mở/đóng — tick ô chọn không được kéo theo.
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className="border-input accent-primary h-4 w-4 shrink-0 cursor-pointer rounded disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

/** Ô chọn cả nhóm: tick khi đã chọn hết, gạch ngang khi mới chọn một phần. */
function HopChonNhom({ ids, chon, label }: { ids: string[]; chon: BoChon; label: string }) {
  const soDaChon = ids.filter(chon.daChon).length;
  return (
    <HopChon
      checked={ids.length > 0 && soDaChon === ids.length}
      indeterminate={soDaChon > 0 && soDaChon < ids.length}
      disabled={ids.length === 0}
      onChange={() => chon.datNhieu(ids, soDaChon < ids.length)}
      label={label}
    />
  );
}

// ── Một câu hỏi ───────────────────────────────────────────────

function QuestionRow({
  q,
  categoryId,
  chon,
}: {
  q: QuestionItem;
  categoryId: string;
  chon: BoChon;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICON[q.type];
  const daChon = chon.daChon(q.id);

  return (
    <div
      className={cn(
        'border-border bg-card overflow-hidden rounded-xl border',
        daChon && 'border-primary/50 ring-primary/20 ring-1'
      )}
    >
      <div
        className="hover:bg-accent/30 flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <HopChon checked={daChon} onChange={() => chon.dao(q.id)} label="Chọn câu hỏi này" />
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            TYPE_BADGE[q.type]
          )}
        >
          {Icon && <Icon className="h-3 w-3" />}
          {TYPE_SHORT[q.type]}
        </span>
        <p className="line-clamp-1 min-w-0 flex-1 text-sm">{stripHtml(q.content)}</p>
        <div className="flex shrink-0 items-center gap-2">
          {(q.quizCount ?? 0) > 0 && (
            <span
              className="text-muted-foreground hidden text-xs sm:inline"
              title="Quiz mẫu trong ngân hàng nội dung đang dùng câu này"
            >
              {q.quizCount} quiz mẫu ·
            </span>
          )}
          <span className="text-muted-foreground text-xs">{q.points}đ</span>
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Link
              href={`/question-banks/${categoryId}/questions/${q.id}/edit`}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                'text-muted-foreground/40 hover:text-foreground'
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <DeleteQuestionButton
              questionId={q.id}
              confirmMessage={`Xoá câu hỏi này khỏi ngân hàng? ${BAN_SAO_GIU_NGUYEN}${canhBaoQuizMau([q])}`}
            />
          </div>
          {expanded ? (
            <ChevronDown className="text-muted-foreground/40 h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="text-muted-foreground/40 h-3.5 w-3.5" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-border bg-muted/20 border-t px-5 py-4">
          <RichTextView html={q.content} className="text-sm" />
          {q.options.length > 0 && (
            <ul className="mt-3 space-y-1">
              {q.options.map((o) => (
                <li
                  key={o.id}
                  className={cn(
                    'flex items-start gap-1.5 text-sm',
                    o.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
                  )}
                >
                  <span className="shrink-0">{o.isCorrect ? '✓' : '·'}</span>
                  <OptionContent type={q.type} content={o.content} className="flex-1" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Một thư mục ───────────────────────────────────────────────

function FolderBlock({
  folder,
  categoryId,
  open,
  onToggle,
  chon,
}: {
  folder: CategoryWithQuestions;
  categoryId: string;
  open: boolean;
  onToggle: () => void;
  chon: BoChon;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  function luuTen() {
    const ten = name.trim();
    if (!ten || ten === folder.name) {
      setEditing(false);
      setName(folder.name);
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.patch(`/questions/bank-folders/${folder.id}`, { name: ten });
        toast.success('Đã đổi tên thư mục.');
        setEditing(false);
        router.refresh();
      } catch (err) {
        setName(folder.name);
        toast.error(loiCua(err, 'Không đổi được tên thư mục.'));
      }
    });
  }

  /**
   * Hỏi xác nhận NGOÀI `startTransition` — gói vào trong là khoá chết: React 19
   * chưa vẽ cập nhật bên trong một action async cho tới khi action kết thúc, mà
   * action lại đang chờ cú bấm trong hộp thoại chưa được vẽ. Nút im lặng không
   * phản hồi, không có lỗi nào để lần ra.
   */
  async function xoa() {
    const n = folder.questions.length;
    const ok = await openConfirm(
      n === 0
        ? `Xoá thư mục “${folder.name}”?`
        : `Xoá thư mục “${folder.name}” cùng ${n} câu hỏi bên trong? ${BAN_SAO_GIU_NGUYEN}${canhBaoQuizMau(folder.questions)}`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const res = await apiClient.delete<{ message?: string }>(
          `/questions/bank-folders/${folder.id}`
        );
        toast.success(res?.message || 'Đã xoá thư mục.');
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không xoá được thư mục.'));
      }
    });
  }

  return (
    <section className="space-y-2">
      {confirmDialog}
      <header className="flex flex-wrap items-center gap-2">
        <HopChonNhom
          ids={folder.questions.map((q) => q.id)}
          chon={chon}
          label={`Chọn mọi câu hỏi trong ${folder.name}`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? `Thu gọn ${folder.name}` : `Mở rộng ${folder.name}`}
          className="text-muted-foreground hover:text-foreground hover:bg-muted -ml-1 shrink-0 rounded-md p-1 transition-colors"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <FolderOpen className="text-primary h-4 w-4 shrink-0" />
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') luuTen();
                if (e.key === 'Escape') {
                  setName(folder.name);
                  setEditing(false);
                }
              }}
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
            />
            <button
              type="button"
              onClick={luuTen}
              disabled={pending}
              className="text-emerald-700 disabled:opacity-50 dark:text-emerald-400"
              aria-label="Lưu tên"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setName(folder.name);
                setEditing(false);
              }}
              className="text-muted-foreground"
              aria-label="Huỷ"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold">
              <button type="button" onClick={onToggle} className="cursor-pointer text-left">
                {folder.name}
              </button>
            </h2>
            <span className="text-muted-foreground text-xs">{folder.questions.length} câu hỏi</span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-foreground/40 hover:text-foreground"
              aria-label="Đổi tên thư mục"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={xoa}
              disabled={pending}
              className="text-muted-foreground/40 hover:text-destructive disabled:opacity-50"
              aria-label="Xoá thư mục"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Link
            href={`/question-banks/${categoryId}/questions/import?folder=${folder.id}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs')}
          >
            <FileUp className="mr-1 h-3.5 w-3.5" />
            Nhập từ Word
          </Link>
          <Link
            href={`/question-banks/${categoryId}/questions/new?folder=${folder.id}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs')}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Thêm câu hỏi
          </Link>
        </div>
      </header>

      {!open ? null : folder.questions.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-4 text-xs">
          Thư mục trống.
        </p>
      ) : (
        <div className="space-y-2">
          {folder.questions.map((q) => (
            <QuestionRow key={q.id} q={q} categoryId={categoryId} chon={chon} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Toàn bộ kho ───────────────────────────────────────────────

export function CategoryBankManager({ data }: { data: CategoryQuestionBankData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  // Mặc định đóng hết: kho lớn có hàng chục thư mục, bấm vào mới hiện câu hỏi.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [daChonIds, setDaChonIds] = useState<Set<string>>(new Set());
  const [confirmDialog, openConfirm] = useConfirmDialog();

  const tatCaCau = [...data.folders.flatMap((f) => f.questions), ...data.uncategorized];
  // Lọc theo dữ liệu đang hiện: câu vừa bị xoá ở chỗ khác (xoá lẻ, xoá cả thư
  // mục) biến khỏi danh sách nhưng id của nó có thể còn nằm trong bộ chọn.
  const dangChon = tatCaCau.filter((q) => daChonIds.has(q.id));

  const chon: BoChon = {
    daChon: (id) => daChonIds.has(id),
    dao: (id) =>
      setDaChonIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    datNhieu: (ids, bat) =>
      setDaChonIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (bat) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
  };

  /** Hỏi xác nhận NGOÀI startTransition — xem ghi chú ở FolderBlock.xoa. */
  async function xoaDaChon() {
    const cacCau = dangChon;
    const ok = await openConfirm(
      `Xoá ${cacCau.length} câu hỏi đã chọn? ${BAN_SAO_GIU_NGUYEN}${canhBaoQuizMau(cacCau)}`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const res = await apiClient.post<BulkDeleteQuestionsResult>('/questions/bulk-delete', {
          ids: cacCau.map((q) => q.id),
        });
        toast.success(res.message);
        setDaChonIds(new Set());
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không xoá được các câu hỏi đã chọn.'));
      }
    });
  }

  const allIds = [
    ...data.folders.map((f) => f.id),
    ...(data.uncategorized.length > 0 ? [CHUA_XEP] : []),
  ];
  const allOpen = allIds.length > 0 && allIds.every((id) => expanded.has(id));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const tongCau =
    data.folders.reduce((s, f) => s + f.questions.length, 0) + data.uncategorized.length;

  function themThuMuc() {
    const ten = newName.trim();
    if (!ten) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/questions/bank-categories/${data.categoryId}/folders`, {
          name: ten,
        });
        toast.success('Đã thêm thư mục.');
        setNewName('');
        setAdding(false);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không thêm được thư mục.'));
      }
    });
  }

  return (
    <div className="space-y-8">
      {confirmDialog}
      <div className="border-border bg-muted/20 flex flex-wrap items-center gap-3 rounded-xl border p-4">
        <HelpCircle className="text-muted-foreground h-4 w-4 shrink-0" />
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
          {data.folders.length} thư mục · {tongCau} câu hỏi. Mọi khoá học thuộc nhánh{' '}
          <span className="text-foreground font-medium">{data.categoryPath}</span> đều thấy kho này
          ở trang “Ngân hàng chung” và chép về được.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <FolderPlus className="mr-1.5 h-4 w-4" />
            Thêm thư mục
          </button>
          <Link
            href={`/question-banks/${data.categoryId}/questions/new`}
            className={buttonVariants({ size: 'sm' })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Thêm câu hỏi
          </Link>
        </div>
      </div>

      {adding && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') themThuMuc();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="Tên thư mục, ví dụ “Chương 1 — Thuật toán”"
            className="border-input bg-background h-9 flex-1 rounded-lg border px-3 text-sm"
          />
          <button
            type="button"
            onClick={themThuMuc}
            disabled={pending || !newName.trim()}
            className={buttonVariants({ size: 'sm' })}
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Huỷ
          </button>
        </div>
      )}

      {allIds.length > 0 && (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger className="border-border hover:border-primary/40 hover:text-foreground text-muted-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors outline-none focus-visible:ring-3">
              <ListTree className="h-3.5 w-3.5" />
              {allOpen ? 'Đang mở tất cả' : 'Mở rộng'}
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setExpanded(new Set(allIds))}>
                Mở tất cả
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExpanded(new Set())}>
                Đóng tất cả
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {data.folders.map((f) => (
        <FolderBlock
          key={f.id}
          folder={f}
          categoryId={data.categoryId}
          open={expanded.has(f.id)}
          onToggle={() => toggle(f.id)}
          chon={chon}
        />
      ))}

      {data.uncategorized.length > 0 && (
        <section className="space-y-2">
          <header className="flex items-center gap-2">
            <HopChonNhom
              ids={data.uncategorized.map((q) => q.id)}
              chon={chon}
              label="Chọn mọi câu hỏi chưa xếp thư mục"
            />
            <button
              type="button"
              onClick={() => toggle(CHUA_XEP)}
              aria-expanded={expanded.has(CHUA_XEP)}
              className="flex items-center gap-2"
            >
              {expanded.has(CHUA_XEP) ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
              <FolderOpen className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-semibold">Chưa xếp thư mục</h2>
            </button>
            <span className="text-muted-foreground text-xs">
              {data.uncategorized.length} câu hỏi
            </span>
          </header>
          {expanded.has(CHUA_XEP) && (
            <div className="space-y-2">
              {data.uncategorized.map((q) => (
                <QuestionRow key={q.id} q={q} categoryId={data.categoryId} chon={chon} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Thanh thao tác bám đáy màn hình khi đang chọn — kho dài hàng trăm câu,
          chọn xong ở cuối trang thì không phải cuộn ngược lên tìm nút xoá. */}
      {dangChon.length > 0 && (
        <div
          role="region"
          aria-label="Thao tác với các câu hỏi đã chọn"
          className="border-border bg-card sticky bottom-4 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 shadow-lg"
        >
          <span className="text-sm font-medium">Đã chọn {dangChon.length} câu hỏi</span>
          {dangChon.length < tatCaCau.length && (
            <button
              type="button"
              onClick={() =>
                chon.datNhieu(
                  tatCaCau.map((q) => q.id),
                  true
                )
              }
              className="text-primary text-xs hover:underline"
            >
              Chọn cả {tatCaCau.length} câu
            </button>
          )}
          <button
            type="button"
            onClick={() => setDaChonIds(new Set())}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Bỏ chọn
          </button>
          <button
            type="button"
            onClick={() => void xoaDaChon()}
            disabled={pending}
            className={cn(buttonVariants({ variant: 'destructive', size: 'sm' }), 'ml-auto')}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {pending ? 'Đang xoá...' : `Xoá ${dangChon.length} câu hỏi`}
          </button>
        </div>
      )}

      {tongCau === 0 && data.folders.length === 0 && (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed py-14 text-center text-sm">
          Kho này chưa có gì. Thêm thư mục để sắp xếp, hoặc thêm thẳng câu hỏi.
        </div>
      )}
    </div>
  );
}
