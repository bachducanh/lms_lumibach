'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { apiClient, ApiError } from '@/lib/api-client';

type Course = { id: string; name: string; slug: string };

type Props = {
  studentId: string;
  studentName: string;
  courses: Course[];
  onEnrolled?: (courseId: string, courseName: string, courseSlug: string) => void;
};

export function EnrollStudentDialog({ studentId, studentName, courses, onEnrolled }: Props) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [pending, startEnroll] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId) {
      toast.error('Vui lòng chọn khóa học');
      return;
    }
    startEnroll(async () => {
      try {
        const course = courses.find((c) => c.id === courseId)!;
        await apiClient.post(`/courses/${courseId}/enroll`, {
          identifier: studentId,
          userId: studentId,
        });
        toast.success(`Đã thêm học sinh vào "${course.name}".`);
        onEnrolled?.(course.id, course.name, course.slug);
        setOpen(false);
        setCourseId('');
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi thêm học sinh');
      }
    });
  }

  if (courses.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="h-4 w-4" />
        Thêm vào khóa học
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Thêm vào khóa học</DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          Thêm <span className="text-foreground font-medium">{studentName}</span> vào khóa học:
        </p>

        <form onSubmit={handleSubmit} className="mt-1 space-y-4">
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="border-input bg-background focus:ring-ring h-9 w-full rounded-md border px-3 text-sm focus:ring-2 focus:outline-none"
            required
          >
            <option value="">— Chọn khóa học —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={pending || !courseId} className="gap-2">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? 'Đang thêm...' : 'Thêm vào lớp'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
