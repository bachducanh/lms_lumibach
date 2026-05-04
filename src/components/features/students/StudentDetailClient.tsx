'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BookOpen, TrendingUp, Code2, Trash2, Loader2 } from 'lucide-react';
import { EnrollStudentDialog } from './EnrollStudentDialog';
import { removeStudentFromCourseAction } from '@/actions/students';
import { cn } from '@/lib/utils';
import type { StudentEnrollment } from '@/actions/students';

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE:    'Đang học',
  COMPLETED: 'Hoàn thành',
  DROPPED:   'Đã rời',
  SUSPENDED: 'Tạm dừng',
};

const ENROLLMENT_STATUS_CLASS: Record<string, string> = {
  ACTIVE:    'bg-green-500/10 text-green-700 dark:text-green-400',
  COMPLETED: 'bg-blue-500/10 text-blue-400',
  DROPPED:   'bg-muted text-muted-foreground',
  SUSPENDED: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};

type Course = { id: string; name: string; slug: string };

type Props = {
  studentId:   string;
  studentName: string;
  courses:     Course[];
  canManage:   boolean;
  initialEnrollments: StudentEnrollment[];
};

export function StudentDetailClient({
  studentId, studentName, courses, canManage, initialEnrollments,
}: Props) {
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>(initialEnrollments);
  const [removingId,  setRemovingId]  = useState<string | null>(null);
  const [, startRemove] = useTransition();

  function handleEnrolled(courseId: string, courseName: string, courseSlug: string) {
    const newEnrollment: StudentEnrollment = {
      id:         `optimistic-${Date.now()}`,
      courseId,
      courseName,
      courseSlug,
      status:     'ACTIVE',
      progress:   0,
      enrolledAt: new Date(),
      quizScore:  null,
      codeScore:  null,
    };
    setEnrollments((prev) => [newEnrollment, ...prev]);
  }

  function handleRemove(enrollmentId: string) {
    setRemovingId(enrollmentId);
    startRemove(async () => {
      const res = await removeStudentFromCourseAction(enrollmentId);
      if (!res.success) { toast.error(res.error); setRemovingId(null); return; }
      toast.success(res.message);
      setEnrollments((prev) => prev.filter((e) => e.id !== enrollmentId));
      setRemovingId(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">
            Khóa học đang tham gia
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {enrollments.length}
            </span>
          </h2>
        </div>
        {canManage && (
          <EnrollStudentDialog
            studentId={studentId}
            studentName={studentName}
            courses={courses.filter((c) => !enrollments.some((e) => e.courseId === c.id))}
            onEnrolled={handleEnrolled}
          />
        )}
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-10 text-center">
          <p className="text-sm text-muted-foreground">Học sinh chưa tham gia khóa học nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enrollments.map((e) => (
            <div
              key={e.id}
              className="rounded-xl border border-border bg-card px-4 py-4 space-y-3"
            >
              {/* Course name + status */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/courses/${e.courseSlug}`}
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {e.courseName}
                  </Link>
                  <span className={cn(
                    'ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    ENROLLMENT_STATUS_CLASS[e.status] ?? 'bg-muted text-muted-foreground',
                  )}>
                    {ENROLLMENT_STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleRemove(e.id)}
                    disabled={removingId === e.id}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    {removingId === e.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Trash2 className="h-3 w-3" />}
                    Xóa khỏi lớp
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Tiến độ
                  </span>
                  <span className="font-medium">{Math.round(e.progress * 100)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.round(e.progress * 100)}%` }}
                  />
                </div>
              </div>

              {/* Scores */}
              <div className="flex flex-wrap gap-4 text-sm">
                {e.quizScore != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Quiz:</span>
                    <span className={cn(
                      'font-semibold tabular-nums',
                      e.quizScore >= 8 ? 'text-green-600 dark:text-green-400'
                        : e.quizScore >= 5 ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-destructive',
                    )}>
                      {e.quizScore}/10
                    </span>
                  </div>
                )}
                {e.codeScore != null && (
                  <div className="flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Code:</span>
                    <span className={cn(
                      'font-semibold tabular-nums',
                      e.codeScore >= 8 ? 'text-green-600 dark:text-green-400'
                        : e.codeScore >= 5 ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-destructive',
                    )}>
                      {e.codeScore}/10
                    </span>
                  </div>
                )}
                {e.quizScore == null && e.codeScore == null && (
                  <span className="text-xs text-muted-foreground italic">Chưa có điểm</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
