import { cookies } from 'next/headers';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { apiServerClient, ApiError } from '@/lib/api-client';
import { CategoryTreeManager } from '@/components/features/categories/CategoryTreeManager';
import { buttonVariants } from '@/components/ui/button';
import type { CategoryTreeNode, CourseListItem } from '@lumibach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quản lý danh mục' };

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const api = apiServerClient(await cookies());
  let tree: CategoryTreeNode[] = [];
  let loadError: string | null = null;

  try {
    tree = await api.get<CategoryTreeNode[]>('/categories/tree');
  } catch (err) {
    loadError = err instanceof ApiError ? err.message : 'Không tải được cây danh mục.';
  }

  const sp = await searchParams;
  const requestedCategoryId = typeof sp.categoryId === 'string' ? sp.categoryId : null;
  const selectedNode = findCategoryNode(tree, requestedCategoryId) ?? firstCategoryNode(tree);
  const selectedCategoryId = selectedNode?.id ?? null;
  const selectedBreadcrumb = selectedCategoryId
    ? (findCategoryPath(tree, selectedCategoryId) ?? [selectedNode!.name])
    : [];
  const canCreateCourseInSelected = selectedNode ? selectedNode.children.length === 0 : false;

  let courses: CourseListItem[] = [];
  let courseTotal = 0;
  let courseLoadError: string | null = null;

  if (!loadError && selectedCategoryId) {
    const courseParams = new URLSearchParams({
      categoryId: selectedCategoryId,
      includeSubcategories: 'true',
      pageSize: '100',
    });

    try {
      const data = await api.get<{
        courses: CourseListItem[];
        total: number;
        totalPages: number;
      }>(`/courses?${courseParams.toString()}`);
      courses = data.courses;
      courseTotal = data.total;
    } catch (err) {
      courseLoadError =
        err instanceof ApiError ? err.message : 'Không tải được danh sách khoá học.';
    }
  }

  return (
    <div className="lb-stagger space-y-5">
      <div style={{ ['--i' as string]: 0 }}>
        {loadError ? (
          <div className="border-destructive/30 bg-destructive/5 rounded-xl border border-dashed p-8 text-center">
            <AlertTriangle className="text-destructive mx-auto h-8 w-8" />
            <p className="mt-3 font-semibold">Không tải được danh mục khoá học</p>
            <p className="text-muted-foreground mt-1 text-sm">{loadError}</p>
            <Link
              href="/admin/categories"
              className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' mt-4'}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Thử lại
            </Link>
          </div>
        ) : (
          <CategoryTreeManager
            initialTree={tree}
            selectedCategoryId={selectedCategoryId}
            selectedCategoryTitle={selectedNode?.name ?? 'Khoá học'}
            selectedCategoryBreadcrumb={selectedBreadcrumb}
            canCreateCourseInSelected={canCreateCourseInSelected}
            courses={courses}
            courseTotal={courseTotal}
            courseLoadError={courseLoadError}
          />
        )}
      </div>
    </div>
  );
}

function firstCategoryNode(tree: CategoryTreeNode[]): CategoryTreeNode | null {
  return tree[0] ?? null;
}

function findCategoryNode(
  nodes: CategoryTreeNode[],
  id: string | null | undefined
): CategoryTreeNode | null {
  if (!id) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findCategoryNode(node.children, id);
    if (found) return found;
  }
  return null;
}

function findCategoryPath(
  nodes: CategoryTreeNode[],
  id: string,
  path: string[] = []
): string[] | null {
  for (const node of nodes) {
    const nextPath = [...path, node.name];
    if (node.id === id) return nextPath;
    const found = findCategoryPath(node.children, id, nextPath);
    if (found) return found;
  }
  return null;
}
