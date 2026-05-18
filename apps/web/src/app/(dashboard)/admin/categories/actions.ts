'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { apiServerClient, ApiError } from '@/lib/api-client';
import type { CategoryListItem, CreateCategoryBody, UpdateCategoryBody } from '@lumibach/types';

type Result<T> = T | { error: string };

export async function createCategoryAction(
  body: CreateCategoryBody
): Promise<Result<CategoryListItem>> {
  try {
    const api = apiServerClient(await cookies());
    const data = await api.post<CategoryListItem>('/categories', body);
    revalidatePath('/admin/categories');
    revalidatePath('/courses', 'layout');
    return data;
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Lỗi tạo danh mục' };
  }
}

export async function updateCategoryAction(
  id: string,
  body: UpdateCategoryBody
): Promise<Result<CategoryListItem>> {
  try {
    const api = apiServerClient(await cookies());
    const data = await api.patch<CategoryListItem>(`/categories/${id}`, body);
    revalidatePath('/admin/categories');
    revalidatePath('/courses', 'layout');
    return data;
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Lỗi cập nhật danh mục' };
  }
}

export async function deleteCategoryAction(id: string): Promise<Result<{ ok: true }>> {
  try {
    const api = apiServerClient(await cookies());
    await api.delete<void>(`/categories/${id}`);
    revalidatePath('/admin/categories');
    revalidatePath('/courses', 'layout');
    return { ok: true };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Lỗi xoá danh mục' };
  }
}
