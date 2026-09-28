'use client';

import { createContext, useContext, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CornerLeftUp,
  FileUp,
  FolderInput,
  FolderOpen,
  FolderPlus,
  GripVertical,
  HelpCircle,
  ListTree,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BulkDeleteQuestionsResult,
  BulkMoveQuestionsResult,
  CategoryQuestionBankData,
  CategoryWithQuestions,
  QuestionItem,
} from '@lumibach/types';
import { thuMucTrongNhanh } from '@lumibach/types/folder-tree';
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
import { BankFolderPicker } from '@/components/features/quiz/BankFolderPicker';
import {
  HopChon,
  HopChonNhom,
  NhapTenThuMuc,
  VungTha,
  useBoChon,
  useCamBienKeo,
  vaChamTheoConTro,
  type BoChon,
} from '@/components/features/bank/BankTreeParts';
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

// ── Trạng thái dùng chung cho cả cây ──────────────────────────
//
// Thư mục lồng nhau dựng bằng đệ quy; chuyền tay từng thứ qua mọi cấp thì mỗi
// cấp lại phải biết về những thứ nó không dùng. Để chung một chỗ cho gọn.

/** Thứ đang được kéo: một câu (kéo theo cả nhóm đã chọn nếu câu đó nằm trong nhóm) hay một thư mục. */
type VatKeo = { loai: 'cau'; id: string } | { loai: 'thuMuc'; id: string };

/** Chỗ thả: `dich` null là "chưa xếp thư mục" (với câu) hay "cấp ngoài cùng" (với thư mục). */
type ChoTha = { dich: string | null; nhan: 'ca-hai' | 'cau' | 'thuMuc' };

type Kho = {
  categoryId: string;
  chon: BoChon;
  dangMo: (id: string) => boolean;
  daoMo: (id: string) => void;
  moRa: (id: string) => void;
  thuMucCon: (parentId: string) => CategoryWithQuestions[];
  /** Mọi câu trong thư mục và các thư mục con của nó, ở mọi cấp. */
  cauTrongNhanh: (folderId: string) => QuestionItem[];
  soThuMucCon: (folderId: string) => number;
  dangKeo: VatKeo | null;
  /** Thư mục không nhận được thứ đang kéo (thư mục đang kéo và nhánh con của nó). */
  khongThaDuoc: Set<string>;
  moChuyenThuMuc: (folder: CategoryWithQuestions) => void;
};

const KhoContext = createContext<Kho | null>(null);

function useKho(): Kho {
  const kho = useContext(KhoContext);
  if (!kho) throw new Error('useKho phải nằm trong CategoryBankManager');
  return kho;
}

// ── Một câu hỏi ───────────────────────────────────────────────

function QuestionRow({ q }: { q: QuestionItem }) {
  const { categoryId, chon } = useKho();
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICON[q.type];
  const daChon = chon.daChon(q.id);
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `cau:${q.id}`,
    data: { loai: 'cau', id: q.id } satisfies VatKeo,
  });

  return (
    <div
      className={cn(
        'border-border bg-card overflow-hidden rounded-xl border',
        daChon && 'border-primary/50 ring-primary/20 ring-1',
        isDragging && 'opacity-40'
      )}
    >
      {/* Kéo được cả dòng: nhấn giữ rồi rê. Bấm thường (không rê) vẫn là mở/đóng,
          vẫn tick được ô chọn — bộ cảm biến chỉ nhận là kéo khi đã rê vài px. */}
      <div
        ref={setNodeRef}
        {...listeners}
        className="hover:bg-accent/30 flex cursor-pointer touch-manipulation items-center gap-3 px-4 py-3 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <GripVertical
          className="text-muted-foreground/30 -mr-1.5 -ml-2 h-4 w-4 shrink-0 cursor-grab"
          aria-hidden
        />
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

// ── Một thư mục (đệ quy) ──────────────────────────────────────

function FolderNode({ folder }: { folder: CategoryWithQuestions }) {
  const kho = useKho();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [themCon, setThemCon] = useState(false);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  const open = kho.dangMo(folder.id);
  const con = kho.thuMucCon(folder.id);
  const cauNhanh = kho.cauTrongNhanh(folder.id);
  const soCon = kho.soThuMucCon(folder.id);

  const {
    setNodeRef: setDragRef,
    listeners,
    isDragging,
  } = useDraggable({
    id: `thuMuc:${folder.id}`,
    data: { loai: 'thuMuc', id: folder.id } satisfies VatKeo,
    disabled: editing,
  });
  const khongNhan = kho.khongThaDuoc.has(folder.id);
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `tha:${folder.id}`,
    data: { dich: folder.id, nhan: 'ca-hai' } satisfies ChoTha,
    disabled: khongNhan,
  });

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

  function taoThuMucCon(ten: string) {
    if (!ten) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/questions/bank-categories/${kho.categoryId}/folders`, {
          name: ten,
          parentId: folder.id,
        });
        toast.success('Đã thêm thư mục con.');
        setThemCon(false);
        kho.moRa(folder.id);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không thêm được thư mục con.'));
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
    const phan = [
      soCon > 0 ? `${soCon} thư mục con` : '',
      cauNhanh.length > 0 ? `${cauNhanh.length} câu hỏi` : '',
    ].filter(Boolean);
    const ok = await openConfirm(
      phan.length === 0
        ? `Xoá thư mục “${folder.name}”?`
        : `Xoá thư mục “${folder.name}” cùng ${phan.join(' và ')} bên trong? ${BAN_SAO_GIU_NGUYEN}${canhBaoQuizMau(cauNhanh)}`
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

  const nutNho = 'text-muted-foreground/40 hover:text-foreground disabled:opacity-50';

  return (
    <section className={cn('space-y-2', isDragging && 'opacity-40')}>
      {confirmDialog}
      <header
        ref={(el) => {
          setDragRef(el);
          setDropRef(el);
        }}
        {...listeners}
        className={cn(
          '-mx-2 flex touch-manipulation flex-wrap items-center gap-2 rounded-lg px-2 py-1 transition-colors',
          isOver && 'bg-primary/10 ring-primary ring-2',
          kho.dangKeo && !khongNhan && !isOver && 'ring-border ring-dashed ring-1'
        )}
      >
        <GripVertical
          className="text-muted-foreground/30 -mr-1 h-4 w-4 shrink-0 cursor-grab"
          aria-hidden
        />
        <HopChonNhom
          ids={cauNhanh.map((q) => q.id)}
          chon={kho.chon}
          label={`Chọn mọi câu hỏi trong ${folder.name} và các thư mục con`}
        />
        <button
          type="button"
          onClick={() => kho.daoMo(folder.id)}
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
              <button
                type="button"
                onClick={() => kho.daoMo(folder.id)}
                className="cursor-pointer text-left"
              >
                {folder.name}
              </button>
            </h2>
            <span className="text-muted-foreground text-xs">
              {folder.questions.length} câu hỏi
              {soCon > 0 && ` · ${soCon} thư mục con`}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={nutNho}
              aria-label="Đổi tên thư mục"
              title="Đổi tên"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setThemCon((v) => !v)}
              className={nutNho}
              aria-label="Thêm thư mục con"
              title="Thêm thư mục con"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => kho.moChuyenThuMuc(folder)}
              className={nutNho}
              aria-label="Chuyển thư mục tới…"
              title="Chuyển thư mục tới…"
            >
              <FolderInput className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={xoa}
              disabled={pending}
              className="text-muted-foreground/40 hover:text-destructive disabled:opacity-50"
              aria-label="Xoá thư mục"
              title="Xoá thư mục"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Link
            href={`/question-banks/${kho.categoryId}/questions/import?folder=${folder.id}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs')}
          >
            <FileUp className="mr-1 h-3.5 w-3.5" />
            Nhập từ Word
          </Link>
          <Link
            href={`/question-banks/${kho.categoryId}/questions/new?folder=${folder.id}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs')}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Thêm câu hỏi
          </Link>
        </div>
      </header>

      {themCon && (
        <div className="border-border ml-3 border-l pl-4">
          <NhapTenThuMuc
            placeholder={`Tên thư mục con trong “${folder.name}”`}
            pending={pending}
            onLuu={taoThuMucCon}
            onHuy={() => setThemCon(false)}
          />
        </div>
      )}

      {open && (
        <div className="border-border ml-3 space-y-3 border-l pl-4">
          {con.map((c) => (
            <FolderNode key={c.id} folder={c} />
          ))}
          {folder.questions.length > 0 && (
            <div className="space-y-2">
              {folder.questions.map((q) => (
                <QuestionRow key={q.id} q={q} />
              ))}
            </div>
          )}
          {con.length === 0 && folder.questions.length === 0 && (
            <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-4 text-xs">
              Thư mục trống. Kéo câu hỏi vào đây, hoặc dùng “Thêm câu hỏi”.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ── Toàn bộ kho ───────────────────────────────────────────────

type DangChuyen = { loai: 'cau' } | { loai: 'thuMuc'; folder: CategoryWithQuestions };

export function CategoryBankManager({ data }: { data: CategoryQuestionBankData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  // Mặc định đóng hết: kho lớn có hàng chục thư mục, bấm vào mới hiện câu hỏi.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const chon = useBoChon();
  const [dangKeo, setDangKeo] = useState<VatKeo | null>(null);
  const [dangChuyen, setDangChuyen] = useState<DangChuyen | null>(null);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  const sensors = useCamBienKeo();

  // ── Cây thư mục dựng từ danh sách phẳng ──
  const cay = useMemo(() => {
    const theoId = new Map(data.folders.map((f) => [f.id, f]));
    const con = new Map<string | null, CategoryWithQuestions[]>();
    for (const f of data.folders) {
      const cha = f.parentId && theoId.has(f.parentId) ? f.parentId : null;
      con.set(cha, [...(con.get(cha) ?? []), f]);
    }
    for (const ds of con.values()) ds.sort((a, b) => a.position - b.position);
    return { theoId, con };
  }, [data.folders]);

  const nhanhCua = useMemo(() => {
    const cache = new Map<string, string[]>();
    return (id: string) => {
      let ds = cache.get(id);
      if (!ds) {
        ds = thuMucTrongNhanh(data.folders, id);
        cache.set(id, ds);
      }
      return ds;
    };
  }, [data.folders]);

  const tatCaCau = useMemo(
    () => [...data.folders.flatMap((f) => f.questions), ...data.uncategorized],
    [data]
  );
  // Lọc theo dữ liệu đang hiện: câu vừa bị xoá ở chỗ khác (xoá lẻ, xoá cả thư
  // mục) biến khỏi danh sách nhưng id của nó có thể còn nằm trong bộ chọn.
  const dangChon = tatCaCau.filter((q) => chon.ids.has(q.id));

  function daoMo(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function moRa(id: string | null) {
    setExpanded((prev) => new Set(prev).add(id ?? CHUA_XEP));
  }

  const khongThaDuoc = useMemo(
    () => new Set(dangKeo?.loai === 'thuMuc' ? nhanhCua(dangKeo.id) : []),
    [dangKeo, nhanhCua]
  );

  const kho: Kho = {
    categoryId: data.categoryId,
    chon,
    dangMo: (id) => expanded.has(id),
    daoMo,
    moRa: (id) => moRa(id),
    thuMucCon: (id) => cay.con.get(id) ?? [],
    cauTrongNhanh: (id) => nhanhCua(id).flatMap((fid) => cay.theoId.get(fid)?.questions ?? []),
    soThuMucCon: (id) => nhanhCua(id).length - 1,
    dangKeo,
    khongThaDuoc,
    moChuyenThuMuc: (folder) => setDangChuyen({ loai: 'thuMuc', folder }),
  };

  // ── Chuyển ──

  function chuyenCau(ids: string[], dich: string | null) {
    startTransition(async () => {
      try {
        const res = await apiClient.post<BulkMoveQuestionsResult>('/questions/bulk-move', {
          ids,
          categoryId: dich,
        });
        toast.success(res.message);
        chon.boHet();
        moRa(dich);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không chuyển được câu hỏi.'));
      }
    });
  }

  function chuyenThuMuc(id: string, dich: string | null) {
    startTransition(async () => {
      try {
        const res = await apiClient.patch<{ message: string }>(
          `/questions/bank-folders/${id}/move`,
          { parentId: dich }
        );
        toast.success(res.message);
        if (dich) moRa(dich);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không chuyển được thư mục.'));
      }
    });
  }

  /** Câu đang kéo nằm trong nhóm đã chọn thì kéo theo cả nhóm — như trình quản lý tệp. */
  function cauSeChuyen(id: string): string[] {
    return chon.ids.has(id) ? dangChon.map((q) => q.id) : [id];
  }

  function onDragStart(e: DragStartEvent) {
    setDangKeo((e.active.data.current as VatKeo | undefined) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    const vat = e.active.data.current as VatKeo | undefined;
    const cho = e.over?.data.current as ChoTha | undefined;
    setDangKeo(null);
    if (!vat || !cho) return;

    if (vat.loai === 'cau') {
      if (cho.nhan === 'thuMuc') return;
      const ids = cauSeChuyen(vat.id);
      // Thả vào đúng chỗ đang đứng thì không làm gì.
      const dangO = new Set(
        tatCaCau.filter((q) => ids.includes(q.id)).map((q) => q.categoryId ?? null)
      );
      if (dangO.size === 1 && dangO.has(cho.dich)) return;
      chuyenCau(ids, cho.dich);
      return;
    }

    if (cho.nhan === 'cau') return;
    if (cho.dich && khongThaDuoc.has(cho.dich)) return;
    if ((cay.theoId.get(vat.id)?.parentId ?? null) === cho.dich) return;
    chuyenThuMuc(vat.id, cho.dich);
  }

  /** Hỏi xác nhận NGOÀI startTransition — xem ghi chú ở FolderNode.xoa. */
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
        chon.boHet();
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không xoá được các câu hỏi đã chọn.'));
      }
    });
  }

  function themThuMuc(ten: string) {
    if (!ten) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/questions/bank-categories/${data.categoryId}/folders`, {
          name: ten,
        });
        toast.success('Đã thêm thư mục.');
        setAdding(false);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không thêm được thư mục.'));
      }
    });
  }

  const allIds = [
    ...data.folders.map((f) => f.id),
    ...(data.uncategorized.length > 0 ? [CHUA_XEP] : []),
  ];
  const allOpen = allIds.length > 0 && allIds.every((id) => expanded.has(id));
  const tongCau = tatCaCau.length;
  const goc = cay.con.get(null) ?? [];

  // Cả nhóm đã chọn đang cùng ở một chỗ thì đánh dấu chỗ đó trong hộp chọn đích.
  const choCuaNhomChon = new Set(dangChon.map((q) => q.categoryId ?? null));
  const keoThuMuc = dangKeo?.loai === 'thuMuc' ? cay.theoId.get(dangKeo.id) : undefined;
  const soCauDangKeo = dangKeo?.loai === 'cau' ? cauSeChuyen(dangKeo.id).length : 0;

  return (
    <KhoContext.Provider value={kho}>
      <DndContext
        sensors={sensors}
        collisionDetection={vaChamTheoConTro}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDangKeo(null)}
      >
        <div className="space-y-6">
          {confirmDialog}
          <div className="border-border bg-muted/20 flex flex-wrap items-center gap-3 rounded-xl border p-4">
            <HelpCircle className="text-muted-foreground h-4 w-4 shrink-0" />
            <p className="text-muted-foreground min-w-0 flex-1 text-sm">
              {data.folders.length} thư mục · {tongCau} câu hỏi. Mọi khoá học thuộc nhánh{' '}
              <span className="text-foreground font-medium">{data.categoryPath}</span> đều thấy kho
              này ở trang “Ngân hàng chung” và chép về được. Kéo câu hỏi hay thư mục thả vào thư mục
              khác để sắp xếp lại.
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
            <NhapTenThuMuc
              placeholder="Tên thư mục, ví dụ “Chương 1 — Thuật toán”"
              pending={pending}
              onLuu={themThuMuc}
              onHuy={() => setAdding(false)}
            />
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

          {/* Chỉ hiện khi đang kéo một thư mục con — chỗ để đưa nó ra ngoài cùng. */}
          {keoThuMuc?.parentId && (
            <VungTha
              id="tha:goc"
              data={{ dich: null, nhan: 'thuMuc' } satisfies ChoTha}
              className="border-border text-muted-foreground flex items-center gap-2 border border-dashed px-4 py-3 text-sm"
            >
              <CornerLeftUp className="h-4 w-4" />
              Thả vào đây để đưa “{keoThuMuc.name}” ra cấp ngoài cùng
            </VungTha>
          )}

          <div className="space-y-6">
            {goc.map((f) => (
              <FolderNode key={f.id} folder={f} />
            ))}
          </div>

          {/* Nhóm chưa xếp thư mục — cũng là chỗ thả để bỏ câu hỏi ra khỏi thư mục,
              nên vẫn hiện khi đang kéo câu hỏi dù nhóm đang trống. */}
          {(data.uncategorized.length > 0 || dangKeo?.loai === 'cau') && (
            <section className="space-y-2">
              <VungTha
                id="tha:chua-xep"
                data={{ dich: null, nhan: 'cau' } satisfies ChoTha}
                className="-mx-2 px-2 py-1"
              >
                <header className="flex items-center gap-2">
                  <HopChonNhom
                    ids={data.uncategorized.map((q) => q.id)}
                    chon={chon}
                    label="Chọn mọi câu hỏi chưa xếp thư mục"
                  />
                  <button
                    type="button"
                    onClick={() => daoMo(CHUA_XEP)}
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
              </VungTha>
              {expanded.has(CHUA_XEP) && data.uncategorized.length > 0 && (
                <div className="space-y-2">
                  {data.uncategorized.map((q) => (
                    <QuestionRow key={q.id} q={q} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Thanh thao tác bám đáy màn hình khi đang chọn — kho dài hàng trăm câu,
              chọn xong ở cuối trang thì không phải cuộn ngược lên tìm nút. */}
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
                onClick={chon.boHet}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Bỏ chọn
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDangChuyen({ loai: 'cau' })}
                  disabled={pending}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <FolderInput className="mr-1.5 h-4 w-4" />
                  Chuyển tới…
                </button>
                <button
                  type="button"
                  onClick={() => void xoaDaChon()}
                  disabled={pending}
                  className={buttonVariants({ variant: 'destructive', size: 'sm' })}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {`Xoá ${dangChon.length} câu hỏi`}
                </button>
              </div>
            </div>
          )}

          {tongCau === 0 && data.folders.length === 0 && (
            <div className="border-border text-muted-foreground rounded-xl border border-dashed py-14 text-center text-sm">
              Kho này chưa có gì. Thêm thư mục để sắp xếp, hoặc thêm thẳng câu hỏi.
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dangKeo && (
            <div className="bg-card border-primary/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-xl">
              {dangKeo.loai === 'cau' ? (
                <>
                  <GripVertical className="text-muted-foreground h-4 w-4" />
                  {soCauDangKeo > 1 ? `Chuyển ${soCauDangKeo} câu hỏi` : 'Chuyển 1 câu hỏi'}
                </>
              ) : (
                <>
                  <FolderOpen className="text-primary h-4 w-4" />
                  {keoThuMuc?.name}
                </>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <BankFolderPicker
        open={dangChuyen !== null}
        onOpenChange={(o) => {
          if (!o) setDangChuyen(null);
        }}
        folders={data.folders}
        {...(dangChuyen?.loai === 'thuMuc'
          ? {
              title: `Chuyển thư mục “${dangChuyen.folder.name}” tới…`,
              description: 'Thư mục được chuyển cùng mọi thứ bên trong nó.',
              noneLabel: 'Cấp ngoài cùng',
              disabledIds: new Set(nhanhCua(dangChuyen.folder.id)),
              currentId: dangChuyen.folder.parentId ?? null,
              onPick: (id: string | null) => chuyenThuMuc(dangChuyen.folder.id, id),
            }
          : {
              title: `Chuyển ${dangChon.length} câu hỏi tới…`,
              noneLabel: 'Chưa xếp thư mục',
              currentId: choCuaNhomChon.size === 1 ? [...choCuaNhomChon][0] : undefined,
              onPick: (id: string | null) =>
                chuyenCau(
                  dangChon.map((q) => q.id),
                  id
                ),
            })}
      />
    </KhoContext.Provider>
  );
}
