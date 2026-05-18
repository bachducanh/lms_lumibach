'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Tag,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CategoryFormDialog } from './CategoryFormDialog';
import { deleteCategoryAction } from '@/app/(dashboard)/admin/categories/actions';
import { useRouter } from 'next/navigation';
import type { CategoryListItem, CategoryTreeNode } from '@lumibach/types';

type Props = { initialTree: CategoryTreeNode[] };

type DialogState =
  | { type: 'create-root' }
  | { type: 'create-child'; parentId: string }
  | { type: 'edit'; category: CategoryListItem }
  | null;

export function CategoryTreeManager({ initialTree }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(() => collectAllIds(initialTree));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<CategoryListItem | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDelete(cat: CategoryListItem) {
    startTransition(async () => {
      const result = await deleteCategoryAction(cat.id);
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      toast.success('Đã xoá danh mục');
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="border-border bg-card rounded-xl border">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Cây danh mục
          </p>
          <Button size="sm" onClick={() => setDialog({ type: 'create-root' })}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tạo danh mục gốc
          </Button>
        </div>

        <div className="p-3">
          {initialTree.length === 0 ? (
            <div className="py-12 text-center">
              <Folder className="text-muted-foreground/30 mx-auto h-10 w-10" />
              <p className="text-muted-foreground mt-3 text-sm">Chưa có danh mục nào</p>
              <p className="text-muted-foreground/70 mt-1 text-xs">
                Tạo danh mục gốc (vd: Năm học 2025-2026) để bắt đầu.
              </p>
            </div>
          ) : (
            initialTree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                onAddChild={(parentId) => setDialog({ type: 'create-child', parentId })}
                onEdit={(c) => setDialog({ type: 'edit', category: c })}
                onDelete={(c) => setDeleting(c)}
              />
            ))
          )}
        </div>
      </div>

      {dialog && (
        <CategoryFormDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          config={
            dialog.type === 'edit'
              ? { mode: 'edit', category: dialog.category }
              : {
                  mode: 'create',
                  parentId: dialog.type === 'create-child' ? dialog.parentId : null,
                }
          }
          onSuccess={() => router.refresh()}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá danh mục?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xoá <span className="font-semibold">{deleting?.name}</span>? Hành
              động này không thể hoàn tác. Danh mục đang chứa khoá học hoặc danh mục con sẽ không
              xoá được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) handleDelete(deleting);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Đang xoá...' : 'Xoá'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: CategoryTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (cat: CategoryListItem) => void;
  onDelete: (cat: CategoryListItem) => void;
}) {
  const isLeaf = node.children.length === 0;
  const isOpen = expanded.has(node.id);
  const canDelete = node._count.children === 0 && node._count.courses === 0;

  const { children: _children, ...rest } = node;
  const asListItem: CategoryListItem = rest;

  return (
    <div>
      <div
        className="group hover:bg-accent/40 flex items-center gap-1.5 rounded px-1.5 py-1.5 text-sm"
        style={{ paddingLeft: `${depth * 18 + 6}px` }}
      >
        {isLeaf ? (
          <span className="w-5" />
        ) : (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="hover:bg-accent rounded p-0.5"
            aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {isLeaf ? (
          <Tag className="text-primary/70 h-3.5 w-3.5 shrink-0" />
        ) : isOpen ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        )}

        <span className="flex-1 truncate font-medium">{node.name}</span>

        {/* Counts */}
        <div className="text-muted-foreground hidden items-center gap-3 text-xs sm:flex">
          {node._count.children > 0 && (
            <span className="flex items-center gap-1">
              <Folder className="h-3 w-3" />
              {node._count.children}
            </span>
          )}
          {node._count.courses > 0 && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {node._count.courses}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            title="Tạo danh mục con"
            className="hover:bg-accent text-muted-foreground hover:text-foreground rounded p-1"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(asListItem)}
            title="Sửa"
            className="hover:bg-accent text-muted-foreground hover:text-foreground rounded p-1"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(asListItem)}
            disabled={!canDelete}
            title={canDelete ? 'Xoá' : 'Còn chứa danh mục con/khoá học, không xoá được'}
            className={cn(
              'rounded p-1 transition-colors',
              canDelete
                ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                : 'text-muted-foreground/30 cursor-not-allowed'
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!isLeaf && isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function collectAllIds(tree: CategoryTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const visit = (nodes: CategoryTreeNode[]) => {
    for (const n of nodes) {
      if (n.children.length > 0) {
        ids.add(n.id);
        visit(n.children);
      }
    }
  };
  visit(tree);
  return ids;
}
