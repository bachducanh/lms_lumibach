'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, FolderKanban, HelpCircle, ListTree } from 'lucide-react';
import type { ManageableBankCategory } from '@lumibach/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
 * Mặc định mọi nhánh đều đóng: trường nhiều khối lớp thì mở hết ra là một danh
 * sách dài không đọc được, trong khi thứ giáo viên cần thấy trước là các danh
 * mục gốc — chỗ soạn một lần dùng cho cả môn.
 *
 * Đường dẫn đặt bằng font mono: nó là địa chỉ trong cây, không phải câu văn.
 */

type TreeNode = {
  category: ManageableBankCategory;
  depth: number;
  children: TreeNode[];
};

/**
 * Dựng cây từ đường dẫn dạng "Trường / Khối 10 / 10E1".
 *
 * Gắn mỗi danh mục vào tổ tiên GẦN NHẤT có mặt trong danh sách, không phải cha
 * trực tiếp: giáo viên chỉ nhận được những danh mục họ quản lý, nên một tầng ở
 * giữa có thể vắng. Nếu đòi đúng cha trực tiếp thì những nhánh đó rụng khỏi cây.
 */
function buildTree(categories: ManageableBankCategory[]): TreeNode[] {
  const byPath = new Map<string, TreeNode>();
  const sorted = [...categories].sort((a, b) => a.path.localeCompare(b.path, 'vi'));

  for (const category of sorted) {
    byPath.set(category.path, { category, depth: 0, children: [] });
  }

  const roots: TreeNode[] = [];

  for (const category of sorted) {
    const node = byPath.get(category.path)!;
    const parts = category.path.split(' / ');

    let parent: TreeNode | undefined;
    for (let cut = parts.length - 1; cut > 0 && !parent; cut--) {
      parent = byPath.get(parts.slice(0, cut).join(' / '));
    }

    if (parent) {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function collectIdsWithChildren(nodes: TreeNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      acc.push(node.category.id);
      collectIdsWithChildren(node.children, acc);
    }
  }
  return acc;
}

export function BankCategoryList({ categories }: { categories: ManageableBankCategory[] }) {
  const roots = useMemo(() => buildTree(categories), [categories]);
  const expandableIds = useMemo(() => collectIdsWithChildren(roots), [roots]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOpen = expandableIds.length > 0 && expanded.size === expandableIds.length;

  return (
    <div className="space-y-3">
      {expandableIds.length > 0 && (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger className="border-border hover:border-primary/40 hover:text-foreground text-muted-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors outline-none focus-visible:ring-3">
              <ListTree className="h-3.5 w-3.5" />
              {allOpen ? 'Đang mở tất cả' : 'Mở rộng'}
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setExpanded(new Set(expandableIds))}>
                Mở tất cả
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExpanded(new Set())}>
                Đóng tất cả
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <ul className="space-y-1.5">
        {roots.map((node) => (
          <CategoryRow key={node.category.id} node={node} expanded={expanded} onToggle={toggle} />
        ))}
      </ul>
    </div>
  );
}

function CategoryRow({
  node,
  expanded,
  onToggle,
}: {
  node: TreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const c = node.category;
  const parts = c.path.split(' / ');
  const parents = parts.slice(0, -1);
  const leaf = parts.at(-1) ?? c.name;
  const isRoot = node.depth === 0;
  const depth = Math.min(node.depth, 4);
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(c.id);

  return (
    <li style={{ paddingLeft: `${depth * 1.5}rem` }}>
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
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(c.id)}
              aria-expanded={isOpen}
              aria-label={isOpen ? `Thu gọn ${leaf}` : `Mở rộng ${leaf}`}
              className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 -ml-1 shrink-0 rounded-md p-1 transition-colors outline-none focus-visible:ring-3"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden />
          )}

          <div className="min-w-0 flex-1">
            {parents.length > 0 && (
              <p className="text-muted-foreground/60 truncate font-mono text-[11px] tracking-tight">
                {parents.join(' / ')} /
              </p>
            )}
            <p className="truncate text-sm font-semibold">{leaf}</p>
            <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
              {c.questionCount} câu hỏi · {c.moduleCount} chương
              {hasChildren && !isOpen && ` · ${node.children.length} danh mục con`}
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

      {hasChildren && isOpen && (
        <ul className="mt-1.5 space-y-1.5">
          {node.children.map((child) => (
            <CategoryRow
              key={child.category.id}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
