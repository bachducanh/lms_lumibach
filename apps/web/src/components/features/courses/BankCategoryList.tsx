import Link from 'next/link';
import { FolderKanban, HelpCircle } from 'lucide-react';
import type { ManageableBankCategory } from '@lumibach/types';
import { cn } from '@/lib/utils';

/**
 * Danh sách danh mục soạn được kho, bày theo ĐỘ SÂU của cây danh mục.
 *
 * Vì sao không phải một danh sách phẳng: cả tính năng xoay quanh chuyện nội dung
 * nằm ở một TẦNG và chảy xuống mọi lớp bên dưới. Soạn vào "Tin học" là soạn cho
 * cả môn; soạn vào "Tin học / Khối 10 / 10E1" là soạn cho đúng một lớp. Bày mọi
 * danh mục thành những thẻ giống hệt nhau là giấu đi đúng điều giáo viên cần cân
 * nhắc trước khi gõ chữ đầu tiên. Thanh dọc bên trái thụt vào theo độ sâu nói
 * điều đó mà không cần một đoạn giải thích.
 *
 * Đường dẫn đặt bằng font mono: nó là địa chỉ trong cây, không phải câu văn.
 */
export function BankCategoryList({ categories }: { categories: ManageableBankCategory[] }) {
  // Độ sâu nông nhất trong danh sách = mốc 0, để nhánh nào cũng bắt đầu sát lề
  // thay vì bị đẩy vào giữa trang khi người dùng chỉ quản lý các lớp lá.
  const depths = categories.map((c) => c.path.split(' / ').length);
  const base = depths.length > 0 ? Math.min(...depths) : 1;

  return (
    <ul className="space-y-1.5">
      {categories.map((c) => {
        const parts = c.path.split(' / ');
        const depth = Math.min(parts.length - base, 4);
        const parents = parts.slice(0, -1);
        const leaf = parts.at(-1) ?? c.name;
        const isRoot = depth === 0;

        return (
          <li key={c.id} style={{ paddingLeft: `${depth * 1.5}rem` }}>
            <div
              className={cn(
                'group border-border bg-card relative rounded-xl border transition-colors',
                'hover:border-primary/40'
              )}
            >
              {/* Thanh kế thừa: đậm ở danh mục gốc (phủ nhiều lớp nhất), nhạt dần
                  khi xuống sâu. Đây là chỗ duy nhất trang này dùng màu thương hiệu. */}
              <span
                aria-hidden
                className={cn(
                  'absolute top-3 bottom-3 left-0 w-0.5 rounded-full transition-colors',
                  isRoot ? 'bg-primary/70' : depth === 1 ? 'bg-primary/40' : 'bg-border'
                )}
              />

              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 pl-5">
                <div className="min-w-0 flex-1">
                  {parents.length > 0 && (
                    <p className="text-muted-foreground/60 truncate font-mono text-[11px] tracking-tight">
                      {parents.join(' / ')} /
                    </p>
                  )}
                  <p className="truncate text-sm font-semibold">{leaf}</p>
                  <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                    {c.questionCount} câu hỏi · {c.moduleCount} chương
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Link
                    href={`/question-banks/${c.id}`}
                    className="border-border hover:border-primary/40 hover:text-foreground text-muted-foreground inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Câu hỏi
                  </Link>
                  <Link
                    href={`/question-banks/${c.id}/content`}
                    className="border-border hover:border-primary/40 hover:text-foreground text-muted-foreground inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
                  >
                    <FolderKanban className="h-3.5 w-3.5" />
                    Nội dung
                  </Link>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
