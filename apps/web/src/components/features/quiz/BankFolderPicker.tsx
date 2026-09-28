'use client';

import { useMemo, useState } from 'react';
import { FolderOpen, FolderInput, Search } from 'lucide-react';
// Đường dẫn con: nạp từ gốc gói là kéo mọi schema zod vào bundle trình duyệt.
import { sapTheoCay, type NutThuMuc } from '@lumibach/types/folder-tree';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  folders: NutThuMuc[];
  /**
   * Nhãn của lựa chọn "không vào thư mục nào" — "Chưa xếp thư mục" hay "Cấp ngoài
   * cùng". Bỏ trống khi đích bắt buộc là một thư mục (hoạt động của kho nội dung).
   */
  noneLabel?: string;
  /** Không chọn được: thư mục đang chuyển và nhánh con của nó, hay chỗ đang đứng. */
  disabledIds?: Set<string>;
  /** Chỗ hiện tại (null = không thuộc thư mục nào), để đánh dấu cho dễ nhìn. */
  currentId?: string | null;
  onPick: (folderId: string | null) => void;
};

/**
 * Chọn thư mục đích trong kho câu hỏi — cách thay cho kéo thả, dùng được bằng
 * bàn phím và trên màn hình cảm ứng nhỏ, nơi kéo qua một kho dài rất khó.
 */
export function BankFolderPicker({
  open,
  onOpenChange,
  title,
  description,
  folders,
  noneLabel,
  disabledIds,
  currentId,
  onPick,
}: Props) {
  const [search, setSearch] = useState('');
  const cay = useMemo(() => sapTheoCay(folders), [folders]);

  const q = search.trim().toLowerCase();
  // Tìm theo cả đường dẫn: gõ "chương 2" là hiện đủ các thư mục con của nó.
  const hienThi = q ? cay.filter((f) => f.path.toLowerCase().includes(q)) : cay;

  function chon(id: string | null) {
    onPick(id);
    onOpenChange(false);
    setSearch('');
  }

  const dong = (
    id: string | null,
    nhan: string,
    depth: number,
    tat: boolean,
    laChoHienTai: boolean
  ) => (
    <button
      key={id ?? '__none__'}
      type="button"
      disabled={tat}
      onClick={() => chon(id)}
      style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
      className={cn(
        'flex w-full items-center gap-2 rounded-md py-2 pr-3 text-left text-sm transition-colors',
        tat ? 'text-muted-foreground/50 cursor-not-allowed' : 'hover:bg-accent',
        laChoHienTai && 'font-medium'
      )}
    >
      <FolderOpen
        className={cn('h-4 w-4 shrink-0', id ? 'text-primary' : 'text-muted-foreground')}
      />
      <span className="min-w-0 flex-1 truncate">{nhan}</span>
      {laChoHienTai && <span className="text-muted-foreground text-xs">đang ở đây</span>}
    </button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setSearch('');
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-4 w-4" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {folders.length > 6 && (
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm thư mục..."
              className="pl-8"
              autoFocus
            />
          </div>
        )}

        <div className="max-h-[55vh] space-y-0.5 overflow-y-auto rounded border p-1.5">
          {!q && noneLabel && dong(null, noneLabel, 0, currentId === null, currentId === null)}
          {hienThi.map((f) =>
            dong(
              f.id,
              q ? f.path : f.name,
              q ? 0 : f.depth,
              !!disabledIds?.has(f.id) || currentId === f.id,
              currentId === f.id
            )
          )}
          {q && hienThi.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Không có thư mục nào khớp.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
