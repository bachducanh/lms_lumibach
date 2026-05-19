'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ImagePlus } from 'lucide-react';
import { createCourseAction, updateCourseAction } from '@/app/(dashboard)/courses/actions';
import { CategoryTreePicker } from '@/components/features/categories/CategoryTreePicker';
import type { CreateCourseBody, CourseDetail } from '@lumibach/types';

type CourseFormValues = CreateCourseBody;

type Props = {
  mode: 'create' | 'edit';
  course?: CourseDetail;
  initialCategoryId?: string;
  initialCategoryLabel?: string;
};

const SUBJECT_OPTIONS = ['Tin học', 'Lập trình', 'Toán', 'Vật lý', 'Khác'];
const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'PUBLISHED', label: 'Đang mở' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
] as const;

export function CourseForm({ mode, course, initialCategoryId, initialCategoryLabel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(course?.thumbnail ?? '');
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(course?.thumbnail ?? '');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<CourseFormValues>({
    name: course?.name ?? '',
    shortName: course?.shortName ?? '',
    description: course?.description ?? '',
    subject: course?.subject ?? '',
    categoryId: course?.categoryId ?? initialCategoryId ?? '',
    status: (course?.status as CourseFormValues['status']) ?? 'DRAFT',
    isPublic: course?.isPublic ?? false,
    startDate: course?.startDate ? new Date(course.startDate).toISOString().slice(0, 10) : '',
    endDate: course?.endDate ? new Date(course.endDate).toISOString().slice(0, 10) : '',
  });

  function set<K extends keyof CourseFormValues>(key: K, val: CourseFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleThumbnail(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailPreview(URL.createObjectURL(file));
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    if (course?.id) fd.append('courseId', course.id);
    const res = await fetch('/api/upload/thumbnail', { method: 'POST', body: fd });
    setUploading(false);
    if (res.ok) {
      const data = (await res.json()) as { url: string };
      setThumbnailUrl(data.url);
    } else {
      toast.error('Upload ảnh thất bại');
      setThumbnailPreview(thumbnailUrl);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.categoryId) {
      toast.error('Vui lòng chọn danh mục (lớp học) cho khoá học');
      return;
    }
    startTransition(async () => {
      try {
        const payload = { ...values, thumbnail: thumbnailUrl || undefined };
        const result =
          mode === 'create'
            ? await createCourseAction(payload)
            : await updateCourseAction(course!.id, payload);

        if ('error' in result) {
          toast.error(result.error);
          return;
        }

        toast.success(
          mode === 'create' ? 'Tạo khoá học thành công.' : 'Cập nhật khoá học thành công.'
        );
        window.location.href = `/courses/${result.slug}`;
      } catch {
        toast.error('Lỗi lưu khoá học');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{mode === 'create' ? 'Tạo khoá học mới' : 'Chỉnh sửa khoá học'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Thumbnail */}
          <div className="space-y-1.5">
            <Label>Ảnh bìa</Label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="border-input bg-muted/50 hover:bg-muted relative flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors"
            >
              {thumbnailPreview ? (
                <img
                  src={thumbnailPreview}
                  alt="thumbnail"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-1">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">Nhấn để chọn ảnh (JPG, PNG, WebP · 5 MB)</span>
                </div>
              )}
              {uploading && (
                <div className="bg-background/70 absolute inset-0 flex items-center justify-center text-sm">
                  Đang upload...
                </div>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleThumbnail}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Tên khoá học *</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="VD: Tin học 10 — Lập trình Python cơ bản"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shortName">Tên viết tắt</Label>
            <Input
              id="shortName"
              value={values.shortName ?? ''}
              onChange={(e) => set('shortName', e.target.value)}
              placeholder="VD: TH10-PY"
              maxLength={20}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              value={values.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Mô tả ngắn về khoá học..."
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Danh mục (lớp học) *</Label>
            <CategoryTreePicker
              value={values.categoryId || null}
              onChange={(id) => set('categoryId', id ?? '')}
              leafOnly
              initialLabel={
                course?.category?.breadcrumb.map((c) => c.name).join(' / ') ?? initialCategoryLabel
              }
              placeholder="Chọn lớp học (vd: 10E1)"
              emptyMessage="Chưa có danh mục nào. Admin cần tạo danh mục ở /admin/categories trước."
            />
            <p className="text-muted-foreground text-xs">
              Khoá học phải gắn vào danh mục cấp lá (lớp cụ thể). Admin quản lý cây danh mục ở{' '}
              <a href="/admin/categories" className="text-primary underline">
                /admin/categories
              </a>
              .
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subject">Môn học</Label>
            <select
              id="subject"
              value={values.subject ?? ''}
              onChange={(e) => set('subject', e.target.value)}
              className="border-input bg-background text-foreground dark:bg-card w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">— Chọn môn —</option>
              {SUBJECT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Ngày bắt đầu</Label>
              <Input
                id="startDate"
                type="date"
                value={values.startDate ?? ''}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Ngày kết thúc</Label>
              <Input
                id="endDate"
                type="date"
                value={values.endDate ?? ''}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">Trạng thái</Label>
              <select
                id="status"
                value={values.status}
                onChange={(e) => set('status', e.target.value as CourseFormValues['status'])}
                className="border-input bg-background text-foreground dark:bg-card w-full rounded-md border px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="isPublic"
                type="checkbox"
                checked={values.isPublic}
                onChange={(e) => set('isPublic', e.target.checked)}
                className="border-input accent-primary h-4 w-4 rounded"
              />
              <Label htmlFor="isPublic" className="cursor-pointer">
                Công khai
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || uploading}>
          {uploading
            ? 'Đang upload ảnh...'
            : pending
              ? 'Đang lưu...'
              : mode === 'create'
                ? 'Tạo khoá học'
                : 'Lưu thay đổi'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending || uploading}
        >
          Huỷ
        </Button>
      </div>
    </form>
  );
}
