'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Tag, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import type { CategoryTreeNode } from '@lumibach/types';

type Props = {
  value: string | null;
  onChange: (id: string | null) => void;
  /** Chỉ cho phép chọn leaf (mặc định true). */
  leafOnly?: boolean;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
};

export function CategoryTreePicker({
  value,
  onChange,
  leafOnly = true,
  placeholder = 'Chọn danh mục...',
  allowClear = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<CategoryTreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || tree !== null) return;
    setLoading(true);
    apiClient
      .get<CategoryTreeNode[]>('/categories/tree')
      .then((data) => {
        setTree(data);
        const allIds = new Set<string>();
        const collect = (nodes: CategoryTreeNode[]) => {
          for (const n of nodes) {
            if (n.children.length > 0) {
              allIds.add(n.id);
              collect(n.children);
            }
          }
        };
        collect(data);
        setExpanded(allIds);
      })
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, [open, tree]);

  const selectedLabel = useSelectedLabel(tree, value);

  const filteredTree = useMemo(() => {
    if (!tree) return [];
    if (!search.trim()) return tree;
    const q = search.toLowerCase();
    const filter = (nodes: CategoryTreeNode[]): CategoryTreeNode[] => {
      const out: CategoryTreeNode[] = [];
      for (const n of nodes) {
        const children = filter(n.children);
        if (n.name.toLowerCase().includes(q) || children.length > 0) {
          out.push({ ...n, children });
        }
      }
      return out;
    };
    return filter(tree);
  }, [tree, search]);

  function handleSelect(node: CategoryTreeNode) {
    if (leafOnly && node.children.length > 0) {
      toggle(node.id);
      return;
    }
    onChange(node.id);
    setOpen(false);
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              'border-input bg-background text-foreground dark:bg-card flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
              !disabled && 'hover:border-primary/50',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          />
        }
      >
        <span className={cn(!selectedLabel && 'text-muted-foreground')}>
          {selectedLabel || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {allowClear && value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="text-muted-foreground hover:text-foreground rounded p-0.5"
              aria-label="Xoá lựa chọn"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        </div>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] max-w-md">
        <DialogHeader>
          <DialogTitle>Chọn danh mục</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm danh mục..."
            className="pl-8"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded border p-2">
          {loading && <p className="text-muted-foreground py-6 text-center text-sm">Đang tải...</p>}
          {!loading && filteredTree.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {search ? 'Không tìm thấy danh mục' : 'Chưa có danh mục nào'}
            </p>
          )}
          {!loading &&
            filteredTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                onSelect={handleSelect}
                selectedId={value}
                leafOnly={leafOnly}
              />
            ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  leafOnly,
}: {
  node: CategoryTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: CategoryTreeNode) => void;
  selectedId: string | null;
  leafOnly: boolean;
}) {
  const isLeaf = node.children.length === 0;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const selectable = leafOnly ? isLeaf : true;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-sm transition-colors',
          isSelected
            ? 'bg-primary/15 text-primary font-semibold'
            : selectable
              ? 'hover:bg-accent'
              : 'text-muted-foreground hover:bg-accent/60'
        )}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {isLeaf ? (
          <span className="w-4" />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="hover:bg-accent rounded p-0.5"
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        )}
        {isLeaf ? (
          <Tag className="text-primary/70 h-3.5 w-3.5 shrink-0" />
        ) : isOpen ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        )}
        <span className="flex-1 truncate">{node.name}</span>
        {node._count.courses > 0 && (
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
            {node._count.courses}
          </span>
        )}
      </button>
      {!isLeaf && isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
              leafOnly={leafOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function useSelectedLabel(tree: CategoryTreeNode[] | null, id: string | null): string {
  return useMemo(() => {
    if (!id || !tree) return '';
    const findPath = (nodes: CategoryTreeNode[], path: string[]): string[] | null => {
      for (const n of nodes) {
        const nextPath = [...path, n.name];
        if (n.id === id) return nextPath;
        const found = findPath(n.children, nextPath);
        if (found) return found;
      }
      return null;
    };
    const path = findPath(tree, []);
    return path ? path.join(' / ') : '';
  }, [tree, id]);
}
