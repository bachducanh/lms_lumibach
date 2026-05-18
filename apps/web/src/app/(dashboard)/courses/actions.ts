'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { apiServerClient, ApiError } from '@/lib/api-client';
import type { CreateCourseBody } from '@lumibach/types';

type CoursePayload = CreateCourseBody & { thumbnail?: string };
type Result = { slug: string } | { error: string };

export async function createCourseAction(values: CoursePayload): Promise<Result> {
  try {
    const api = apiServerClient(await cookies());
    const data = await api.post<{ slug: string }>('/courses', values);
    revalidatePath('/courses', 'layout');
    return { slug: data.slug };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Lỗi tạo khoá học' };
  }
}

export async function updateCourseAction(courseId: string, values: CoursePayload): Promise<Result> {
  try {
    const api = apiServerClient(await cookies());
    const data = await api.patch<{ slug: string }>(`/courses/${courseId}`, values);
    revalidatePath('/courses', 'layout');
    revalidatePath(`/courses/${data.slug}`);
    return { slug: data.slug };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Lỗi cập nhật khoá học' };
  }
}
