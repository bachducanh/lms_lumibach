'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ClipboardList,
  Code2,
  Copy,
  FileQuestion,
  FolderPlus,
  Link2,
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
import { apiClient, ApiError } from '@/lib/api-client';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ACTIVITY_TYPE_LABEL, bankContentHref, bankEditorHref } from '@/lib/activity-owner';
import { BankImportDialog } from './BankImportDialog';
import { cn } from '@/lib/utils';

function loiCua(err: unknown, macDinh: string) {
  return err instanceof ApiError ? err.message : macDinh;
}

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

function ItemRow({
  item,
  categoryId,
  moduleId,
  onDelete,
  disabled,
}: {
  item: CategoryBankItem;
  categoryId: string;
  moduleId: string;
  onDelete: (itemId: string, title: string) => void;
  disabled: boolean;
}) {
  const Icon = ITEM_ICON[item.type] ?? BookOpen;
  const editHref = bankEditorHref(categoryId, item, moduleId);

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
    <li className="group/row hover:bg-muted/40 flex items-center gap-3 px-3 py-2.5 transition-colors">
      {/* Cả hàng là đường vào trình soạn — nhắm chuột vào cây bút 14px là việc
          không cần thiết khi hàng nào cũng chỉ có đúng một hành động chính. */}
      {editHref ? (
        <Link href={editHref} className="flex min-w-0 flex-1 items-center gap-3">
          {row}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{row}</span>
      )}
      <button
        type="button"
        onClick={() => onDelete(item.id, item.title)}
        disabled={disabled}
        className={cn(
          'text-muted-foreground/40 hover:text-destructive shrink-0 rounded-md p-1.5 transition-colors disabled:opacity-50',
          // Hiện khi rê chuột hoặc khi bàn phím đi tới — không giấu khỏi người
          // dùng bàn phím, vốn là cái bẫy quen thuộc của kiểu "hiện khi hover".
          'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100'
        )}
        aria-label={`Xoá ${item.title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function ModuleBlock({ mod, categoryId }: { mod: CategoryBankModule; categoryId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(mod.name);
  const [addingType, setAddingType] = useState<BankActivityType | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [language, setLanguage] = useState<string>('PYTHON3');
  const [importing, setImporting] = useState(false);
  const [confirmDialog, openConfirm] = useConfirmDialog();

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
        toast.success('Đã đổi tên chương.');
        setEditing(false);
        router.refresh();
      } catch (err) {
        setName(mod.name);
        toast.error(loiCua(err, 'Không đổi được tên chương.'));
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
  async function xoaChuong() {
    const ok = await openConfirm(
      `Xoá chương “${mod.name}”? ${mod.items.length} hoạt động bên trong sẽ bị xoá theo — khác với thư mục câu hỏi, hoạt động không có chỗ nào khác để giữ lại. Các bản đã chép về khoá học vẫn còn nguyên.`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const res = await apiClient.delete<{ message?: string }>(`/modules/bank-modules/${mod.id}`);
        toast.success(res?.message || 'Đã xoá chương.');
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không xoá được chương.'));
      }
    });
  }

  async function xoaHoatDong(itemId: string, title: string) {
    // Bản mẫu trong kho xoá là mất hẳn: thùng rác chỉ nhận hoạt động của lớp
    // (nó hiển thị kèm tên lớp và khôi phục về lớp). Nói rõ thay vì để giáo
    // viên tưởng còn khôi phục lại được.
    const ok = await openConfirm(
      `Xoá “${title}” khỏi kho? Bản mẫu trong kho không đi qua thùng rác — xoá là mất hẳn. Các bản đã chép về khoá học vẫn còn nguyên.`
    );
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
        router.push(editorHrefFor(categoryId, type, res.contentId));
      } catch (err) {
        toast.error(loiCua(err, 'Không thêm được hoạt động.'));
      }
    });
  }

  return (
    <section className="group/mod space-y-2">
      {confirmDialog}
      {importing && (
        <BankImportDialog
          moduleId={mod.id}
          moduleName={mod.name}
          onClose={() => setImporting(false)}
        />
      )}

      <header className="flex flex-wrap items-center gap-2">
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
            <button type="button" onClick={luuTen} disabled={pending} className="text-emerald-600">
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setName(mod.name);
                setEditing(false);
              }}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold">{mod.name}</h2>
            <span className="text-muted-foreground/70 font-mono text-[11px]">
              {mod.items.length} hoạt động
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-foreground/40 hover:text-foreground opacity-0 transition-opacity group-hover/mod:opacity-100 focus-visible:opacity-100"
              aria-label="Đổi tên chương"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={xoaChuong}
              disabled={pending}
              className="text-muted-foreground/40 hover:text-destructive opacity-0 transition-opacity group-hover/mod:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
              aria-label="Xoá chương"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {/* Sáu nút "Thêm ..." xếp thành một hàng làm tiêu đề chương đọc như thanh
            công cụ chứ không như một tiêu đề. Gom vào một menu: hành động chính
            còn đúng một cái, và danh sách loại có chỗ để ghi rõ từng loại là gì. */}
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
              <DropdownMenuLabel>Soạn mới trong kho</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  router.push(`${bankContentHref(categoryId)}/lessons/new?module=${mod.id}`)
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
                  router.push(`${bankContentHref(categoryId)}/practice-tests/new?module=${mod.id}`)
                }
              >
                <FileQuestion className="mr-2 h-4 w-4" />
                Đề luyện tập
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setImporting(true)}>
                <Copy className="mr-2 h-4 w-4" />
                Chép từ lớp có sẵn
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

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
            className={buttonVariants({ size: 'sm' })}
          >
            Tạo & soạn
          </button>
          <button
            type="button"
            onClick={() => setAddingType(null)}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Huỷ
          </button>
        </div>
      )}

      {mod.items.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed px-4 py-5 text-xs">
          Chương trống. Dùng “Thêm hoạt động” để soạn mục đầu tiên.
        </p>
      ) : (
        <ul className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
          {mod.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              categoryId={categoryId}
              moduleId={mod.id}
              onDelete={xoaHoatDong}
              disabled={pending}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function CategoryContentBankManager({ data }: { data: CategoryContentBankData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const tongHoatDong = data.modules.reduce((s, m) => s + m.items.length, 0);

  function themChuong() {
    const ten = newName.trim();
    if (!ten) return;
    startTransition(async () => {
      try {
        await apiClient.post(`/modules/bank-categories/${data.categoryId}/modules`, { name: ten });
        toast.success('Đã thêm chương.');
        setNewName('');
        setAdding(false);
        router.refresh();
      } catch (err) {
        toast.error(loiCua(err, 'Không thêm được chương.'));
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Thanh phạm vi: nhắc kho này phủ tới đâu. Đặt đường dẫn bằng mono và cho
          nó một thanh dọc như ở trang danh sách, để hai màn hình nói cùng một
          thứ tiếng về "nội dung nằm ở tầng nào". */}
      <div className="border-border bg-muted/20 relative flex flex-wrap items-center gap-3 rounded-xl border p-4">
        <span
          aria-hidden
          className="bg-primary/60 absolute top-4 bottom-4 left-0 w-0.5 rounded-full"
        />
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate font-mono text-[11px] tracking-tight">{data.categoryPath}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.modules.length} chương · {tongHoatDong} hoạt động — mọi lớp trong nhánh này đều
            chép về được.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <FolderPlus className="mr-1.5 h-4 w-4" />
          Thêm chương
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') themChuong();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="Tên chương, ví dụ “Chủ đề A — Máy tính và xã hội tri thức”"
            className="border-input bg-background h-9 flex-1 rounded-md border px-3 text-sm"
          />
          <button
            type="button"
            onClick={themChuong}
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

      {data.modules.map((m) => (
        <ModuleBlock key={m.id} mod={m} categoryId={data.categoryId} />
      ))}

      {data.modules.length === 0 && (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed py-14 text-center text-sm">
          Kho nội dung này chưa có chương nào. Thêm một chương để bắt đầu soạn.
        </div>
      )}

      <p className="text-muted-foreground/70 text-xs leading-relaxed">
        Bản mẫu trong kho không có hạn nộp và không đăng cho học sinh — lịch là việc của từng lớp,
        và thao tác chép về lớp cũng không mang theo. Quiz trong kho lấy câu hỏi từ{' '}
        <Link href={`/question-banks/${data.categoryId}`} className="text-primary hover:underline">
          ngân hàng câu hỏi của danh mục này
        </Link>
        .
      </p>
    </div>
  );
}
