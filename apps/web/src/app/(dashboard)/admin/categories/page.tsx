import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import { CategoryTreeManager } from '@/components/features/categories/CategoryTreeManager';
import type { CategoryTreeNode } from '@lumibach/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quản lý danh mục' };

export default async function AdminCategoriesPage() {
  const api = apiServerClient(await cookies());
  const tree = await api
    .get<CategoryTreeNode[]>('/categories/tree')
    .catch(() => [] as CategoryTreeNode[]);

  return (
    <div className="lb-stagger max-w-3xl space-y-6">
      <div style={{ ['--i' as string]: 0 }}>
        <h1 className="text-2xl font-bold">Quản lý danh mục khoá học</h1>
        <p className="text-muted-foreground text-sm">
          Tạo và sắp xếp danh mục theo cây (vd: <b>Năm học → Khối → Lớp</b>). Khoá học chỉ có thể
          gắn vào danh mục cấp lá.
        </p>
      </div>

      <div style={{ ['--i' as string]: 1 }}>
        <CategoryTreeManager initialTree={tree} />
      </div>
    </div>
  );
}
