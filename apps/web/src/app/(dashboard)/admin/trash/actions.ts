'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { apiServerClient, ApiError } from '@/lib/api-client';

type Result<T> = T | { error: string };

export async function restoreCourseAction(id: string): Promise<Result<{ ok: true }>> {
  try {
    const api = apiServerClient(await cookies());
    await api.post<void>(`/courses/${id}/restore`);
    revalidatePath('/admin/trash');
    revalidatePath('/courses', 'layout');
    return { ok: true };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Lỗi khôi phục khoá học' };
  }
}

export async function purgeCourseAction(id: string): Promise<Result<{ ok: true }>> {
  try {
    const api = apiServerClient(await cookies());
    await api.delete<void>(`/courses/${id}/purge`);
    revalidatePath('/admin/trash');
    revalidatePath('/courses', 'layout');
    return { ok: true };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Lỗi xoá vĩnh viễn khoá học' };
  }
}

export async function restoreActivityAction(
  kind: string,
  id: string
): Promise<Result<{ ok: true; message: string }>> {
  try {
    const api = apiServerClient(await cookies());
    const res = await api.post<{ message: string }>(
      `/courses/trash/activities/${kind}/${id}/restore`
    );
    revalidatePath('/admin/trash');
    revalidatePath('/courses', 'layout');
    return { ok: true, message: res.message };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Lỗi khôi phục hoạt động' };
  }
}

export async function purgeActivityAction(kind: string, id: string): Promise<Result<{ ok: true }>> {
  try {
    const api = apiServerClient(await cookies());
    await api.delete<void>(`/courses/trash/activities/${kind}/${id}`);
    revalidatePath('/admin/trash');
    revalidatePath('/courses', 'layout');
    return { ok: true };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Lỗi xoá vĩnh viễn hoạt động' };
  }
}
