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
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Code2,
  Copy,
  CornerLeftUp,
  FileQuestion,
  FolderInput,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Link2,
  ListTree,
  MessagesSquare,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BankActivityType,
  CategoryBankItem,
  CategoryBankModule,
  CategoryContentBankData,
} from '@lumibach/types';
import { thuMucTrongNhanh } from '@lumibach/types/folder-tree';
import { apiClient, ApiError } from '@/lib/api-client';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ACTIVITY_TYPE_LABEL, bankContentHref, bankEditorHref } from '@/lib/activity-owner';
import { BankImportDialog } from './BankImportDialog';
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
import { cn } from '@/lib/utils';

function loiCua(err: unknown, macDinh: string) {
  return err instanceof ApiError ? err.message : macDinh;
}

const MAT_HAN =
  'Bản mẫu trong kho không đi qua thùng rác — xoá là mất hẳn. Các bản đã chép về khoá học vẫn còn nguyên.';

const ITEM_ICON: Record<string, typeof BookOpen> = {
  LESSON: BookOpen,
  ASSIGNMENT: ClipboardList,
  QUIZ: Brain,
  CODE_EXERCISE: Code2,
  PRACTICE_TEST: FileQuestion,
  FORUM: MessagesSquare,
  FILE: Paperclip,
  EXTERNAL_URL: Link2,
};

/**
 * Nhãn hai chữ cái cho từng loại, đặt bằng font mono.
 *
 * Biểu tượng một mình không phân biệt nổi sáu loại khi chúng xếp chồng thành
 * danh sách dài — bài tập, quiz, đề luyện tập đều là "một tờ giấy có chữ". Cặp
 * chữ cái đọc được ngay cả khi lướt nhanh, và ăn nhịp với đường dẫn danh mục
 * cũng đang đặt bằng mono ở trang trước.
 */
const ITEM_TAG: Record<string, string> = {
  LESSON: 'BG',
  ASSIGNMENT: 'BT',
  QUIZ: 'TN',
  CODE_EXERCISE: 'CODE',
  PRACTICE_TEST: 'ĐỀ',
  FORUM: 'DĐ',
  FILE: 'TỆP',
  EXTERNAL_URL: 'LINK',
};

/**
 * Loại soạn thẳng được ở kho, theo thứ tự hay dùng.
 *
 * Bài giảng và đề luyện tập đi đường riêng: bài giảng mở thẳng trình soạn nội
 * dung, đề luyện tập bắt buộc có file PDF ngay khi tạo. Bốn loại còn lại chỉ
 * cần một cái tên rồi mở trình soạn của chúng.
 */
const QUICK_TYPES: { type: BankActivityType; label: string }[] = [
  { type: 'ASSIGNMENT', label: 'Bài tập' },
  { type: 'QUIZ', label: 'Trắc nghiệm' },
  { type: 'CODE_EXERCISE', label: 'Bài code' },
  { type: 'FORUM', label: 'Diễn đàn' },
];

const CODE_LANGUAGES = [
  { value: 'PYTHON3', label: 'Python 3' },
  { value: 'JAVASCRIPT', label: 'JavaScript' },
  { value: 'CPP17', label: 'C++17' },
  { value: 'WEB', label: 'Web (HTML/CSS/JS)' },
  { value: 'SCRATCH', label: 'Scratch' },
] as const;

/** Đường mở trình soạn ngay sau khi tạo khung, để không phải quay lại tìm. */
function editorHrefFor(categoryId: string, type: BankActivityType, contentId: string): string {
  const base = bankContentHref(categoryId);
  switch (type) {
    case 'ASSIGNMENT':
      return `${base}/assignments/${contentId}/edit`;
    case 'QUIZ':
      return `${base}/quizzes/${contentId}/edit`;
    case 'CODE_EXERCISE':
      return `${base}/exercises/${contentId}/edit`;
    case 'FORUM':
      return `${base}/forums/${contentId}/edit`;
    case 'PRACTICE_TEST':
      return `${base}/practice-tests/${contentId}/edit`;
  }
}

// ── Trạng thái dùng chung cho cả cây ──────────────────────────
//
// Thư mục lồng nhau dựng bằng đệ quy; chuyền tay từng thứ qua mọi cấp thì mỗi
// cấp lại phải biết về những thứ nó không dùng. Để chung một chỗ cho gọn.

/** Thứ đang được kéo: một hoạt động (kéo theo cả nhóm đã chọn nếu nó nằm trong nhóm) hay một thư mục. */
type VatKeo = { loai: 'hoatDong'; id: string } | { loai: 'thuMuc'; id: string };

/**
 * Chỗ thả. Tiêu đề thư mục nhận cả hai loại; vùng "cấp ngoài cùng" (dich null)
 * chỉ nhận thư mục — hoạt động không có chỗ nào ngoài thư mục để đứng.
 */
type ChoTha = { dich: string | null; nhan: 'ca-hai' | 'thuMuc' };

type Kho = {
  categoryId: string;
  chon: BoChon;
  dangMo: (id: string) => boolean;
  daoMo: (id: string) => void;
  moRa: (id: string) => void;
  thuMucCon: (parentId: string) => CategoryBankModule[];
  /** Mọi hoạt động trong thư mục và các thư mục con của nó, ở mọi cấp. */
  hoatDongTrongNhanh: (moduleId: string) => CategoryBankItem[];
  soThuMucCon: (moduleId: string) => number;
  dangKeo: VatKeo | null;
  /** Thư mục không nhận được thứ đang kéo (thư mục đang kéo và nhánh con của nó). */
  khongThaDuoc: Set<string>;
  moChuyenThuMuc: (mod: CategoryBankModule) => void;
};

const KhoContext = createContext<Kho | null>(null);

function useKho(): Kho {
  const kho = useContext(KhoContext);
  if (!kho) throw new Error('useKho phải nằm trong CategoryContentBankManager');
  return kho;
}

// ── Một hoạt động ─────────────────────────────────────────────

function ItemRow({
  item,
  moduleId,
  onDelete,
  disabled,
}: {
  item: CategoryBankItem;
  moduleId: string;
  onDelete: (itemId: string, title: string) => void;
  disabled: boolean;
}) {
  const { categoryId, chon } = useKho();
  const Icon = ITEM_ICON[item.type] ?? BookOpen;
  const editHref = bankEditorHref(categoryId, item, moduleId);
  const daChon = chon.daChon(item.id);
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `hd:${item.id}`,
    data: { loai: 'hoatDong', id: item.id } satisfies VatKeo,
  });

  const row = (
    <>
      <span className="border-border text-muted-foreground/70 flex h-7 w-11 shrink-0 items-center justify-center gap-1 rounded-md border font-mono text-[10px] tracking-wide">
        <Icon className="h-3 w-3" />
        {ITEM_TAG[item.type] ?? '?'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {ACTIVITY_TYPE_LABEL[item.type] ?? item.type}
          {item.detail ? ` · ${item.detail}` : ''}
        </span>
      </span>
    </>
  );

  return (
    // Kéo được cả dòng: nhấn giữ rồi rê. Bấm thường vẫn mở trình soạn — bộ cảm
    // biến chỉ nhận là kéo khi đã rê vài px.
    <li
      ref={setNodeRef}
      {...listeners}
      className={cn(
        'hover:bg-muted/40 flex touch-manipulation items-center gap-3 px-3 py-2.5 transition-colors',
        daChon && 'bg-primary/5',
        isDragging && 'opacity-40'
      )}
    >
      <GripVertical
        className="text-muted-foreground/30 -mr-1.5 h-4 w-4 shrink-0 cursor-grab"
        aria-hidden
      />
      <HopChon checked={daChon} onChange={() => chon.dao(item.id)} label={`Chọn ${item.title}`} />
      {/* Bấm cả hàng cũng vào được trình soạn, nhưng nút bút chì vẫn phải có
          mặt: một affordance chỉ tồn tại khi rê chuột trúng là affordance mà
          người dùng không biết là có. `draggable={false}`: liên kết mặc định kéo
          được theo kiểu của trình duyệt, tranh mất cú kéo thả của trang. */}
      {editHref ? (
        <Link href={editHref} draggable={false} className="flex min-w-0 flex-1 items-center gap-3">
          {row}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{row}</span>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        {editHref && (
          <Link
            href={editHref}
            draggable={false}
            aria-label={`Sửa ${item.title}`}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => onDelete(item.id, item.title)}
          disabled={disabled}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-1.5 transition-colors disabled:opacity-50"
          aria-label={`Xoá ${item.title}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// ── Một thư mục (đệ quy) ──────────────────────────────────────

function ModuleNode({ mod }: { mod: CategoryBankModule }) {
  const kho = useKho();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(mod.name);
  const [themCon, setThemCon] = useState(false);
  const [addingType, setAddingType] = useState<BankActivityType | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [language, setLanguage] = useState<string>('PYTHON3');
  const [importing, setImporting] = useState(false);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  const open = kho.dangMo(mod.id);
  const con = kho.thuMucCon(mod.id);
  const hoatDongNhanh = kho.hoatDongTrongNhanh(mod.id);
  const soCon = kho.soThuMucCon(mod.id);

  const {
    setNodeRef: setDragRef,
    listeners,
    isDragging,
  } = useDraggable({
    id: `thuMuc:${mod.id}`,
    data: { loai: 'thuMuc', id: mod.id } satisfies VatKeo,
    disabled: editing,
  });
  const khongNhan = kho.khongThaDuoc.has(mod.id);
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `tha:${mod.id}`,
    data: { dich: mod.id, nhan: 'ca-hai' } satisfies ChoTha,
    disabled: khongNhan,
  });

  function luuTen() {
    const ten = name.trim();
    if (!ten || ten === mod.name) {
      setEditing(false);
      setName(mod.name);
      return;
    }
    startTransition(async () => {
      try {
        await apiClient.patch(`/modules/bank-modules/${mod.id}`, { name: ten });
        toast.success('Đã đổi tên thư mục.');
        setEditing(false);
        router.refresh();
      } catch (err) {
        setName(mod.name);
        toast.error(loiCua(err, 'Không đổi được tên thư mục.'));
      }
    });
  }

  function taoThuMucCon(ten: string) {
    if (!ten) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/modules/bank-categories/${kho.categoryId}/modules`, {
          name: ten,
          parentId: mod.id,
        });
        toast.success('Đã thêm thư mục con.');
        setThemCon(false);
        kho.moRa(mod.id);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không thêm được thư mục con.'));
      }
    });
  }

  /**
   * Hỏi xác nhận NGOÀI `startTransition`, rồi mới mở transition cho lời gọi API.
   *
   * Gói `openConfirm` vào trong transition là khoá chết: React 19 coi cả hàm
   * async là một action và chưa vẽ cập nhật bên trong cho tới khi action kết
   * thúc — mà action lại đang chờ đúng cú bấm trong hộp thoại chưa được vẽ.
   * Nút không phản hồi, không có lỗi nào để lần ra. Trang Chương của khoá học
   * (ModuleList) vẫn luôn làm theo thứ tự này, đó là lý do nút xoá bên đó chạy.
   */
  async function xoaThuMuc() {
    const phan = [
      soCon > 0 ? `${soCon} thư mục con` : '',
      hoatDongNhanh.length > 0 ? `${hoatDongNhanh.length} hoạt động` : '',
    ].filter(Boolean);
    const ok = await openConfirm(
      phan.length === 0
        ? `Xoá thư mục “${mod.name}”?`
        : `Xoá thư mục “${mod.name}” cùng ${phan.join(' và ')} bên trong? ${MAT_HAN}`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const res = await apiClient.delete<{ message?: string }>(`/modules/bank-modules/${mod.id}`);
        toast.success(res?.message || 'Đã xoá thư mục.');
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không xoá được thư mục.'));
      }
    });
  }

  async function xoaHoatDong(itemId: string, title: string) {
    // Bản mẫu trong kho xoá là mất hẳn: thùng rác chỉ nhận hoạt động của lớp
    // (nó hiển thị kèm tên lớp và khôi phục về lớp). Nói rõ thay vì để giáo
    // viên tưởng còn khôi phục lại được.
    const ok = await openConfirm(`Xoá “${title}” khỏi kho? ${MAT_HAN}`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/modules/bank-items/${itemId}`);
        toast.success('Đã xoá hoạt động khỏi kho.');
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không xoá được hoạt động.'));
      }
    });
  }

  function themHoatDong() {
    const tieuDe = newTitle.trim();
    if (!tieuDe || !addingType) return;
    const type = addingType;
    startTransition(async () => {
      try {
        const res = await apiClient.post<{ itemId: string; contentId: string }>(
          `/modules/bank-modules/${mod.id}/activities`,
          { type, title: tieuDe, ...(type === 'CODE_EXERCISE' ? { language } : {}) }
        );
        setNewTitle('');
        setAddingType(null);
        // Đi thẳng vào trình soạn: khung vừa tạo chưa có đề bài, câu hỏi hay
        // test case nào, để lại trang danh sách là bỏ dở giữa chừng.
        router.push(editorHrefFor(kho.categoryId, type, res.contentId));
      } catch (err) {
        toast.error(loiCua(err, 'Không thêm được hoạt động.'));
      }
    });
  }

  const nutNho =
    'text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1 transition-colors disabled:opacity-50';

  return (
    <section className={cn('space-y-2', isDragging && 'opacity-40')}>
      {confirmDialog}
      {importing && (
        <BankImportDialog
          moduleId={mod.id}
          moduleName={mod.name}
          onClose={() => setImporting(false)}
        />
      )}

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
          ids={hoatDongNhanh.map((i) => i.id)}
          chon={kho.chon}
          label={`Chọn mọi hoạt động trong ${mod.name} và các thư mục con`}
        />
        <button
          type="button"
          onClick={() => kho.daoMo(mod.id)}
          aria-expanded={open}
          aria-label={open ? `Thu gọn ${mod.name}` : `Mở rộng ${mod.name}`}
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
                  setName(mod.name);
                  setEditing(false);
                }
              }}
              className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            />
            <button
              type="button"
              onClick={luuTen}
              disabled={pending}
              className="text-emerald-700 dark:text-emerald-400"
              aria-label="Lưu tên"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setName(mod.name);
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
                onClick={() => kho.daoMo(mod.id)}
                className="cursor-pointer text-left"
              >
                {mod.name}
              </button>
            </h2>
            <span className="text-muted-foreground/70 font-mono text-[11px]">
              {mod.items.length} hoạt động
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
              onClick={() => kho.moChuyenThuMuc(mod)}
              className={nutNho}
              aria-label="Chuyển thư mục tới…"
              title="Chuyển thư mục tới…"
            >
              <FolderInput className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={xoaThuMuc}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-1 transition-colors disabled:opacity-50"
              aria-label="Xoá thư mục"
              title="Xoá thư mục"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {/* Sáu nút "Thêm ..." xếp thành một hàng làm tiêu đề thư mục đọc như
            thanh công cụ chứ không như một tiêu đề. Gom vào một menu: hành động
            chính còn đúng một cái, và danh sách loại có chỗ để ghi rõ từng loại. */}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs')}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Thêm hoạt động
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {/* DropdownMenuLabel BẮT BUỘC nằm trong DropdownMenuGroup: đây là
                  Base UI, không phải Radix, và Menu.GroupLabel ném lỗi khi thiếu
                  context của Menu.Group — đủ để hạ cả trang xuống màn hình lỗi. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>Soạn mới trong kho</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`${bankContentHref(kho.categoryId)}/lessons/new?module=${mod.id}`)
                  }
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Bài giảng
                </DropdownMenuItem>
                {QUICK_TYPES.map((t) => {
                  const Icon = ITEM_ICON[t.type] ?? BookOpen;
                  return (
                    <DropdownMenuItem
                      key={t.type}
                      onClick={() => {
                        setAddingType(t.type);
                        setNewTitle('');
                      }}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {t.label}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuItem
                  onClick={() =>
                    router.push(
                      `${bankContentHref(kho.categoryId)}/practice-tests/new?module=${mod.id}`
                    )
                  }
                >
                  <FileQuestion className="mr-2 h-4 w-4" />
                  Đề luyện tập
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setImporting(true)}>
                <Copy className="mr-2 h-4 w-4" />
                Chép từ lớp có sẵn
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {themCon && (
        <div className="border-border ml-3 border-l pl-4">
          <NhapTenThuMuc
            placeholder={`Tên thư mục con trong “${mod.name}”`}
            pending={pending}
            onLuu={taoThuMucCon}
            onHuy={() => setThemCon(false)}
          />
        </div>
      )}

      {addingType && (
        <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') themHoatDong();
              if (e.key === 'Escape') setAddingType(null);
            }}
            placeholder={`Tên ${(
              QUICK_TYPES.find((t) => t.type === addingType)?.label ?? ''
            ).toLowerCase()}…`}
            className="border-input bg-background h-9 min-w-0 flex-1 rounded-md border px-3 text-sm"
          />
          {addingType === 'CODE_EXERCISE' && (
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Ngôn ngữ lập trình"
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              {CODE_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={themHoatDong}
            disabled={pending || !newTitle.trim()}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            Tạo & soạn
          </button>
          <button
            type="button"
            onClick={() => setAddingType(null)}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            Huỷ
          </button>
        </div>
      )}

      {open && (
        <div className="border-border ml-3 space-y-3 border-l pl-4">
          {con.map((c) => (
            <ModuleNode key={c.id} mod={c} />
          ))}
          {mod.items.length > 0 && (
            <ul className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
              {mod.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  moduleId={mod.id}
                  onDelete={xoaHoatDong}
                  disabled={pending}
                />
              ))}
            </ul>
          )}
          {con.length === 0 && mod.items.length === 0 && (
            <p className="border-border text-muted-foreground rounded-xl border border-dashed px-4 py-5 text-xs">
              Thư mục trống. Dùng “Thêm hoạt động”, hoặc kéo hoạt động từ thư mục khác vào đây.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ── Toàn bộ kho ───────────────────────────────────────────────

type DangChuyen = { loai: 'hoatDong' } | { loai: 'thuMuc'; mod: CategoryBankModule };

export function CategoryContentBankManager({ data }: { data: CategoryContentBankData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  // Kho nội dung trước giờ luôn bày hết ra — giữ mặc định đó: nhớ thư mục ĐANG
  // ĐÓNG thay vì thư mục đang mở, thư mục mới tạo tự hiện ra.
  const [dangDong, setDangDong] = useState<Set<string>>(new Set());
  const [dangKeo, setDangKeo] = useState<VatKeo | null>(null);
  const [dangChuyen, setDangChuyen] = useState<DangChuyen | null>(null);
  const chon = useBoChon();
  const sensors = useCamBienKeo();

  // ── Cây thư mục dựng từ danh sách phẳng ──
  const cay = useMemo(() => {
    const theoId = new Map(data.modules.map((m) => [m.id, m]));
    const con = new Map<string | null, CategoryBankModule[]>();
    for (const m of data.modules) {
      const cha = m.parentId && theoId.has(m.parentId) ? m.parentId : null;
      con.set(cha, [...(con.get(cha) ?? []), m]);
    }
    for (const ds of con.values()) ds.sort((a, b) => a.position - b.position);
    return { theoId, con };
  }, [data.modules]);

  const nhanhCua = useMemo(() => {
    const cache = new Map<string, string[]>();
    return (id: string) => {
      let ds = cache.get(id);
      if (!ds) {
        ds = thuMucTrongNhanh(data.modules, id);
        cache.set(id, ds);
      }
      return ds;
    };
  }, [data.modules]);

  const tatCaHoatDong = useMemo(
    () => data.modules.flatMap((m) => m.items.map((i) => ({ ...i, moduleId: m.id }))),
    [data.modules]
  );
  // Lọc theo dữ liệu đang hiện: hoạt động vừa bị xoá ở chỗ khác biến khỏi danh
  // sách nhưng id của nó có thể còn nằm trong bộ chọn.
  const dangChon = tatCaHoatDong.filter((i) => chon.ids.has(i.id));

  function moRa(id: string) {
    setDangDong((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const khongThaDuoc = useMemo(
    () => new Set(dangKeo?.loai === 'thuMuc' ? nhanhCua(dangKeo.id) : []),
    [dangKeo, nhanhCua]
  );

  const kho: Kho = {
    categoryId: data.categoryId,
    chon,
    dangMo: (id) => !dangDong.has(id),
    daoMo: (id) =>
      setDangDong((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    moRa,
    thuMucCon: (id) => cay.con.get(id) ?? [],
    hoatDongTrongNhanh: (id) => nhanhCua(id).flatMap((mid) => cay.theoId.get(mid)?.items ?? []),
    soThuMucCon: (id) => nhanhCua(id).length - 1,
    dangKeo,
    khongThaDuoc,
    moChuyenThuMuc: (mod) => setDangChuyen({ loai: 'thuMuc', mod }),
  };

  // ── Chuyển ──

  function chuyenHoatDong(ids: string[], dich: string) {
    startTransition(async () => {
      try {
        const res = await apiClient.post<{ message: string }>('/modules/bank-items/move', {
          ids,
          moduleId: dich,
        });
        toast.success(res.message);
        chon.boHet();
        moRa(dich);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không chuyển được hoạt động.'));
      }
    });
  }

  function chuyenThuMuc(id: string, dich: string | null) {
    startTransition(async () => {
      try {
        const res = await apiClient.patch<{ message: string }>(`/modules/bank-modules/${id}/move`, {
          parentId: dich,
        });
        toast.success(res.message);
        if (dich) moRa(dich);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không chuyển được thư mục.'));
      }
    });
  }

  /** Hoạt động đang kéo nằm trong nhóm đã chọn thì kéo theo cả nhóm — như trình quản lý tệp. */
  function hoatDongSeChuyen(id: string): string[] {
    return chon.ids.has(id) ? dangChon.map((i) => i.id) : [id];
  }

  function onDragStart(e: DragStartEvent) {
    setDangKeo((e.active.data.current as VatKeo | undefined) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    const vat = e.active.data.current as VatKeo | undefined;
    const cho = e.over?.data.current as ChoTha | undefined;
    setDangKeo(null);
    if (!vat || !cho) return;

    if (vat.loai === 'hoatDong') {
      // Hoạt động chỉ thả được vào một thư mục thật.
      if (!cho.dich || cho.nhan !== 'ca-hai') return;
      const ids = hoatDongSeChuyen(vat.id);
      const dangO = new Set(tatCaHoatDong.filter((i) => ids.includes(i.id)).map((i) => i.moduleId));
      if (dangO.size === 1 && dangO.has(cho.dich)) return;
      chuyenHoatDong(ids, cho.dich);
      return;
    }

    if (cho.dich && khongThaDuoc.has(cho.dich)) return;
    if ((cay.theoId.get(vat.id)?.parentId ?? null) === cho.dich) return;
    chuyenThuMuc(vat.id, cho.dich);
  }

  function themThuMuc(ten: string) {
    if (!ten) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/modules/bank-categories/${data.categoryId}/modules`, { name: ten });
        toast.success('Đã thêm thư mục.');
        setAdding(false);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không thêm được thư mục.'));
      }
    });
  }

  const tongHoatDong = tatCaHoatDong.length;
  const goc = cay.con.get(null) ?? [];
  const tatCaId = data.modules.map((m) => m.id);
  const dangMoHet = dangDong.size === 0;
  const choCuaNhomChon = new Set(dangChon.map((i) => i.moduleId));
  const keoThuMuc = dangKeo?.loai === 'thuMuc' ? cay.theoId.get(dangKeo.id) : undefined;
  const soDangKeo = dangKeo?.loai === 'hoatDong' ? hoatDongSeChuyen(dangKeo.id).length : 0;

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
          {/* Thanh phạm vi: nhắc kho này phủ tới đâu. Đặt đường dẫn bằng mono và
              cho nó một thanh dọc như ở trang danh sách, để hai màn hình nói cùng
              một thứ tiếng về "nội dung nằm ở tầng nào". */}
          <div className="border-border bg-muted/20 relative flex flex-wrap items-center gap-3 rounded-xl border p-4">
            <span
              aria-hidden
              className="bg-primary/60 absolute top-4 bottom-4 left-0 w-0.5 rounded-full"
            />
            <div className="min-w-0 flex-1 pl-1">
              <p className="truncate font-mono text-[11px] tracking-tight">{data.categoryPath}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {data.modules.length} thư mục · {tongHoatDong} hoạt động — mọi lớp trong nhánh này
                đều chép về được. Kéo hoạt động hay thư mục thả vào thư mục khác để sắp xếp lại.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <FolderPlus className="mr-1.5 h-4 w-4" />
              Thêm thư mục
            </button>
          </div>

          {adding && (
            <NhapTenThuMuc
              placeholder="Tên thư mục, ví dụ “Chủ đề A — Máy tính và xã hội tri thức”"
              pending={pending}
              onLuu={themThuMuc}
              onHuy={() => setAdding(false)}
            />
          )}

          {tatCaId.length > 0 && (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger className="border-border hover:border-primary/40 hover:text-foreground text-muted-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors outline-none focus-visible:ring-3">
                  <ListTree className="h-3.5 w-3.5" />
                  {dangMoHet ? 'Đang mở tất cả' : 'Mở rộng'}
                  <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setDangDong(new Set())}>
                    Mở tất cả
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDangDong(new Set(tatCaId))}>
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

          <div className="space-y-8">
            {goc.map((m) => (
              <ModuleNode key={m.id} mod={m} />
            ))}
          </div>

          {data.modules.length === 0 && (
            <div className="border-border text-muted-foreground rounded-xl border border-dashed py-14 text-center text-sm">
              Kho nội dung này chưa có thư mục nào. Thêm một thư mục để bắt đầu soạn.
            </div>
          )}

          {/* Thanh thao tác bám đáy màn hình khi đang chọn — kho dài, chọn xong ở
              cuối trang thì không phải cuộn ngược lên tìm nút. */}
          {dangChon.length > 0 && (
            <div
              role="region"
              aria-label="Thao tác với các hoạt động đã chọn"
              className="border-border bg-card sticky bottom-4 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 shadow-lg"
            >
              <span className="text-sm font-medium">Đã chọn {dangChon.length} hoạt động</span>
              {dangChon.length < tongHoatDong && (
                <button
                  type="button"
                  onClick={() =>
                    chon.datNhieu(
                      tatCaHoatDong.map((i) => i.id),
                      true
                    )
                  }
                  className="text-primary text-xs hover:underline"
                >
                  Chọn cả {tongHoatDong} hoạt động
                </button>
              )}
              <button
                type="button"
                onClick={chon.boHet}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Bỏ chọn
              </button>
              <button
                type="button"
                onClick={() => setDangChuyen({ loai: 'hoatDong' })}
                disabled={pending}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'ml-auto')}
              >
                <FolderInput className="mr-1.5 h-4 w-4" />
                Chuyển tới…
              </button>
            </div>
          )}

          <p className="text-muted-foreground/70 text-xs leading-relaxed">
            Bản mẫu trong kho không có hạn nộp và không đăng cho học sinh — lịch là việc của từng
            lớp, và thao tác chép về lớp cũng không mang theo. Quiz trong kho lấy câu hỏi từ{' '}
            <Link
              href={`/question-banks/${data.categoryId}`}
              className="text-primary hover:underline"
            >
              ngân hàng câu hỏi của danh mục này
            </Link>
            .
          </p>
        </div>

        <DragOverlay dropAnimation={null}>
          {dangKeo && (
            <div className="bg-card border-primary/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-xl">
              {dangKeo.loai === 'hoatDong' ? (
                <>
                  <GripVertical className="text-muted-foreground h-4 w-4" />
                  {`Chuyển ${soDangKeo} hoạt động`}
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
        folders={data.modules}
        {...(dangChuyen?.loai === 'thuMuc'
          ? {
              title: `Chuyển thư mục “${dangChuyen.mod.name}” tới…`,
              description: 'Thư mục được chuyển cùng mọi thứ bên trong nó.',
              noneLabel: 'Cấp ngoài cùng',
              disabledIds: new Set(nhanhCua(dangChuyen.mod.id)),
              currentId: dangChuyen.mod.parentId ?? null,
              onPick: (id: string | null) => chuyenThuMuc(dangChuyen.mod.id, id),
            }
          : {
              title: `Chuyển ${dangChon.length} hoạt động tới…`,
              currentId: choCuaNhomChon.size === 1 ? [...choCuaNhomChon][0] : undefined,
              onPick: (id: string | null) => {
                if (id)
                  chuyenHoatDong(
                    dangChon.map((i) => i.id),
                    id
                  );
              },
            })}
      />
    </KhoContext.Provider>
  );
}
