'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronRight,
  Eye,
  Folder,
  FolderOpen,
  GraduationCap,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { deleteCourseAction, updateCourseAction } from '@/app/(dashboard)/courses/actions';
import type { CategoryListItem, CategoryTreeNode, CourseListItem } from '@lumibach/types';

type Props = {
  initialTree: CategoryTreeNode[];
  selectedCategoryId: string | null;
  selectedCategoryTitle: string;
  selectedCategoryBreadcrumb: string[];
  canCreateCourseInSelected: boolean;
  courses: CourseListItem[];
  courseTotal: number;
  courseLoadError: string | null;
};

type DialogState =
  | { type: 'create-root' }
  | { type: 'create-child'; parentId: string }
  | { type: 'edit'; category: CategoryListItem }
  | null;

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đang mở',
  ARCHIVED: 'Lưu trữ',
};

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'secondary'> = {
  DRAFT: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'secondary',
};

export function CategoryTreeManager({
  initialTree,
  selectedCategoryId,
  selectedCategoryTitle,
  selectedCategoryBreadcrumb,
  canCreateCourseInSelected,
  courses,
  courseTotal,
  courseLoadError,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(() => collectAllIds(initialTree));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryListItem | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<CourseListItem | null>(null);
  const [categoryPending, startCategoryTransition] = useTransition();
  const [coursePending, startCourseTransition] = useTransition();

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of collectAllIds(initialTree)) next.add(id);
      return next;
    });
  }, [initialTree]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDeleteCategory(cat: CategoryListItem) {
    startCategoryTransition(async () => {
      const result = await deleteCategoryAction(cat.id);
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      toast.success('Đã xoá danh mục');
      setDeletingCategory(null);
      router.refresh();
    });
  }

  function handleDeleteCourse(course: CourseListItem) {
    startCourseTransition(async () => {
      const result = await deleteCourseAction(course.id);
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      toast.success('Đã xoá khoá học');
      setDeletingCourse(null);
      router.refresh();
    });
  }

  function handleArchiveCourse(course: CourseListItem) {
    const nextStatus = course.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED';
    startCourseTransition(async () => {
      const result = await updateCourseAction(course.id, { status: nextStatus });
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      toast.success(nextStatus === 'ARCHIVED' ? 'Đã lưu trữ khoá học' : 'Đã khôi phục khoá học');
      router.refresh();
    });
  }

  const createCourseHref =
    selectedCategoryId && canCreateCourseInSelected
      ? `/courses/new?categoryId=${selectedCategoryId}`
      : '/courses/new';

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.95fr)_minmax(480px,1.05fr)]">
        <section className="min-w-0">
          <div className="border-border border-b pb-2">
            <h2 className="text-2xl font-bold tracking-tight">Danh mục khoá học</h2>
          </div>

          <div className="flex justify-center py-5">
            <Button onClick={() => setDialog({ type: 'create-root' })}>
              <Plus className="mr-1.5 h-4 w-4" />
              Tạo danh mục mới
            </Button>
          </div>

          <div className="border-border bg-card overflow-hidden border">
            {initialTree.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Folder className="text-muted-foreground/30 mx-auto h-10 w-10" />
                <p className="text-muted-foreground mt-3 text-sm">Chưa có danh mục nào</p>
                <p className="text-muted-foreground/70 mt-1 text-xs">
                  Tạo danh mục gốc để bắt đầu quản lý khoá học.
                </p>
              </div>
            ) : (
              <div className="divide-border divide-y">
                {initialTree.map((node) => (
                  <TreeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    selectedId={selectedCategoryId}
                    onToggle={toggle}
                    onAddChild={(parentId) => setDialog({ type: 'create-child', parentId })}
                    onEdit={(c) => setDialog({ type: 'edit', category: c })}
                    onDelete={(c) => setDeletingCategory(c)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-2">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold tracking-tight">
                {selectedCategoryTitle}
              </h2>
              {selectedCategoryBreadcrumb.length > 1 && (
                <p className="text-muted-foreground mt-1 truncate text-xs">
                  {selectedCategoryBreadcrumb.join(' / ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href={createCourseHref} className={buttonVariants()}>
                <Plus className="mr-1.5 h-4 w-4" />
                Tạo khoá học mới
              </Link>
            </div>
          </div>

          {!canCreateCourseInSelected && selectedCategoryId && (
            <div className="border-border bg-muted/30 text-muted-foreground mt-4 rounded-md border px-3 py-2 text-sm">
              Danh mục này đang có danh mục con. Khi tạo khoá học mới, hãy chọn một danh mục cấp lá.
            </div>
          )}

          <div className="border-border bg-card mt-5 overflow-hidden border">
            {!selectedCategoryId ? (
              <EmptyCoursesState message="Chọn hoặc tạo một danh mục để quản lý khoá học." />
            ) : courseLoadError ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <AlertTriangle className="text-destructive h-8 w-8" />
                <p className="font-semibold">Không tải được danh sách khoá học</p>
                <p className="text-muted-foreground max-w-md text-sm">{courseLoadError}</p>
                <Link
                  href={`/admin/categories?categoryId=${selectedCategoryId}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Thử lại
                </Link>
              </div>
            ) : courses.length === 0 ? (
              <EmptyCoursesState message="Danh mục này chưa có khoá học nào." />
            ) : (
              <div className="divide-border divide-y">
                {courses.map((course) => (
                  <CourseRow
                    key={course.id}
                    course={course}
                    pending={coursePending}
                    onArchive={handleArchiveCourse}
                    onDelete={setDeletingCourse}
                  />
                ))}
              </div>
            )}
          </div>

          {courseTotal > courses.length && (
            <p className="text-muted-foreground mt-3 text-center text-xs">
              Đang hiển thị {courses.length}/{courseTotal} khoá học gần nhất trong danh mục này.
            </p>
          )}
        </section>
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
          categoryTree={initialTree}
          onSuccess={() => router.refresh()}
        />
      )}

      <AlertDialog open={!!deletingCategory} onOpenChange={(o) => !o && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá danh mục?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xoá <span className="font-semibold">{deletingCategory?.name}</span>?
              Danh mục đang chứa khoá học hoặc danh mục con sẽ không xoá được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={categoryPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={categoryPending}
              onClick={(e) => {
                e.preventDefault();
                if (deletingCategory) handleDeleteCategory(deletingCategory);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {categoryPending ? 'Đang xoá...' : 'Xoá'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingCourse} onOpenChange={(o) => !o && setDeletingCourse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá khoá học?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xoá <span className="font-semibold">{deletingCourse?.name}</span>?
              Hành động này sẽ ẩn khoá học khỏi danh sách quản lý.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={coursePending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={coursePending}
              onClick={(e) => {
                e.preventDefault();
                if (deletingCourse) handleDeleteCourse(deletingCourse);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {coursePending ? 'Đang xoá...' : 'Xoá'}
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
  selectedId,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: CategoryTreeNode;
  depth: number;
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (cat: CategoryListItem) => void;
  onDelete: (cat: CategoryListItem) => void;
}) {
  const isLeaf = node.children.length === 0;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const canDelete = node._count.children === 0 && node._count.courses === 0;

  const { children: _children, ...rest } = node;
  const asListItem: CategoryListItem = rest;

  return (
    <div>
      <div
        className={cn(
          'group relative flex min-h-12 items-center gap-2 border-l-4 py-2.5 pr-3 text-sm transition-colors',
          isSelected
            ? 'border-l-primary bg-primary/5'
            : 'hover:border-l-primary/40 hover:bg-accent/40 border-l-transparent'
        )}
        style={{ paddingLeft: `${depth * 18 + 12}px` }}
      >
        {isLeaf ? (
          <span className="w-5" />
        ) : (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="hover:bg-accent text-muted-foreground hover:text-foreground rounded p-0.5"
            aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}

        {isLeaf ? (
          <GraduationCap className="text-primary/70 h-4 w-4 shrink-0" />
        ) : isOpen ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-amber-500" />
        )}

        <Link
          href={`/admin/categories?categoryId=${node.id}`}
          className={cn(
            'min-w-0 flex-1 truncate font-medium text-blue-700 hover:underline dark:text-blue-400',
            isSelected && 'text-primary dark:text-primary'
          )}
        >
          {node.name}
        </Link>

        <span className="text-muted-foreground hidden shrink-0 items-center gap-1 text-xs sm:inline-flex">
          {node._count.courses}
          <GraduationCap className="h-3.5 w-3.5" />
        </span>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            title="Tạo danh mục con"
            className="hover:bg-accent rounded p-1.5 text-blue-700 transition-colors hover:text-blue-800 dark:text-blue-400"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(asListItem)}
            title="Sửa danh mục"
            className="hover:bg-accent rounded p-1.5 text-blue-700 transition-colors hover:text-blue-800 dark:text-blue-400"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(asListItem)}
            disabled={!canDelete}
            title={canDelete ? 'Xoá danh mục' : 'Còn chứa danh mục con/khoá học, không xoá được'}
            className={cn(
              'rounded p-1.5 transition-colors',
              canDelete
                ? 'hover:bg-destructive/10 hover:text-destructive text-blue-700 dark:text-blue-400'
                : 'text-muted-foreground/30 cursor-not-allowed'
            )}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <MoreVertical className="text-muted-foreground h-4 w-4" />
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
              selectedId={selectedId}
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

function CourseRow({
  course,
  pending,
  onArchive,
  onDelete,
}: {
  course: CourseListItem;
  pending: boolean;
  onArchive: (course: CourseListItem) => void;
  onDelete: (course: CourseListItem) => void;
}) {
  const statusVariant = STATUS_VARIANT[course.status] ?? 'secondary';
  const statusLabel = STATUS_LABEL[course.status] ?? course.status;
  const ownerName =
    course.owner.fullName ?? `${course.owner.firstName} ${course.owner.lastName}`.trim();

  return (
    <div className="hover:bg-accent/35 flex min-h-14 items-center gap-3 px-4 py-2.5 text-sm transition-colors">
      <span className="text-muted-foreground grid h-6 w-6 shrink-0 place-items-center">
        <GraduationCap className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            href={`/courses/${course.slug}`}
            className="truncate font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            {course.name}
          </Link>
          <Badge variant={statusVariant} className="shrink-0">
            {statusLabel}
          </Badge>
        </div>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
          <span className="truncate">{ownerName}</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {course._count.enrollments} học sinh
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Link
          href={`/courses/${course.slug}/edit`}
          title="Sửa khoá học"
          className="hover:bg-accent rounded p-1.5 text-blue-700 transition-colors hover:text-blue-800 dark:text-blue-400"
        >
          <Pencil className="h-4 w-4" />
        </Link>
        <Link
          href={`/courses/${course.slug}`}
          title="Xem khoá học"
          className="hover:bg-accent rounded p-1.5 text-blue-700 transition-colors hover:text-blue-800 dark:text-blue-400"
        >
          <Eye className="h-4 w-4" />
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => onArchive(course)}
          title={course.status === 'ARCHIVED' ? 'Khôi phục khoá học' : 'Lưu trữ khoá học'}
          className="hover:bg-accent rounded p-1.5 text-blue-700 transition-colors hover:text-blue-800 disabled:opacity-50 dark:text-blue-400"
        >
          {course.status === 'ARCHIVED' ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onDelete(course)}
          title="Xoá khoá học"
          className="hover:bg-destructive/10 hover:text-destructive rounded p-1.5 text-blue-700 transition-colors disabled:opacity-50 dark:text-blue-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyCoursesState({ message }: { message: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <GraduationCap className="text-muted-foreground/30 mx-auto h-10 w-10" />
      <p className="text-muted-foreground mt-3 text-sm">{message}</p>
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
