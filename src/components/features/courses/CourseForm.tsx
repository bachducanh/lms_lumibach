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
import { createCourseAction, updateCourseAction, type CourseFormValues } from '@/actions/courses';
import type { Course } from '@prisma/client';

type Props = {
  mode: 'create' | 'edit';
  course?: Course;
};

const SUBJECT_OPTIONS = ['Tin học', 'Lập trình', 'Toán', 'Vật lý', 'Khác'];
const GRADE_OPTIONS = ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9', 'Lớp 10', 'Lớp 11', 'Lớp 12', 'Đại học'];
const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'PUBLISHED', label: 'Đang mở' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
] as const;

export function CourseForm({ mode, course }: Props) {
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
    gradeLevel: course?.gradeLevel ?? '',
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
    startTransition(async () => {
      const res =
        mode === 'create'
          ? await createCourseAction(values)
          : await updateCourseAction(course!.id, values);

      if (res.success && res.data) {
        toast.success(res.message);
        router.push(`/courses/${res.data.slug}`);
      } else if (!res.success) {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
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
              className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/50 hover:bg-muted transition-colors"
            >
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="thumbnail" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">Nhấn để chọn ảnh (JPG, PNG, WebP · 5 MB)</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Môn học</Label>
              <select
                id="subject"
                value={values.subject ?? ''}
                onChange={(e) => set('subject', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-card"
              >
                <option value="">— Chọn môn —</option>
                {SUBJECT_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gradeLevel">Khối lớp</Label>
              <select
                id="gradeLevel"
                value={values.gradeLevel ?? ''}
                onChange={(e) => set('gradeLevel', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-card"
              >
                <option value="">— Chọn khối —</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-card"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="isPublic"
                type="checkbox"
                checked={values.isPublic}
                onChange={(e) => set('isPublic', e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <Label htmlFor="isPublic" className="cursor-pointer">Công khai</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu...' : mode === 'create' ? 'Tạo khoá học' : 'Lưu thay đổi'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Huỷ
        </Button>
      </div>
    </form>
  );
}
