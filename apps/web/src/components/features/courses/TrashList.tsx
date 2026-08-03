'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import type { TrashedCourseItem } from '@lumibach/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { purgeCourseAction, restoreCourseAction } from '@/app/(dashboard)/admin/trash/actions';

function contentSummary(c: TrashedCourseItem['contents']): string {
  const parts = [
    c.modules && `${c.modules} chương`,
    c.lessons && `${c.lessons} bài giảng`,
    c.assignments && `${c.assignments} bài tập`,
    c.quizzes && `${c.quizzes} quiz`,
    c.enrollments && `${c.enrollments} học sinh`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Không có nội dung';
}

export function TrashList({ courses }: { courses: TrashedCourseItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [purging, setPurging] = useState<TrashedCourseItem | null>(null);

  function handleRestore(course: TrashedCourseItem) {
    startTransition(async () => {
      const result = await restoreCourseAction(course.id);
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Đã khôi phục "${course.name}"`);
      router.refresh();
    });
  }

  function handlePurge() {
    if (!purging) return;
    const course = purging;
    startTransition(async () => {
      const result = await purgeCourseAction(course.id);
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      setPurging(null);
      toast.success(`Đã xoá vĩnh viễn "${course.name}"`);
      router.refresh();
    });
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <Trash2 className="text-muted-foreground mx-auto h-8 w-8" />
        <p className="mt-3 font-semibold">Thùng rác trống</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Khoá học bạn xoá sẽ nằm ở đây 30 ngày trước khi bị xoá vĩnh viễn.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {courses.map((course) => (
          <li
            key={course.id}
            className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold">{course.name}</span>
                <Badge variant={course.daysLeft <= 7 ? 'destructive' : 'secondary'}>
                  {course.daysLeft > 0 ? `Còn ${course.daysLeft} ngày` : 'Sắp bị xoá'}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {contentSummary(course.contents)}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Xoá ngày {new Date(course.deletedAt).toLocaleDateString('vi-VN')} ·{' '}
                {course.owner.fullName ?? course.owner.email}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => handleRestore(course)}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Khôi phục
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => setPurging(course)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Xoá vĩnh viễn
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!purging} onOpenChange={(o) => !o && setPurging(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="text-destructive h-5 w-5" />
              Xoá vĩnh viễn &quot;{purging?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sẽ xoá hẳn {purging && contentSummary(purging.contents).toLowerCase()} cùng toàn bộ
              bài nộp và file đính kèm. <strong>Không thể hoàn tác.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                handlePurge();
              }}
            >
              {pending ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
