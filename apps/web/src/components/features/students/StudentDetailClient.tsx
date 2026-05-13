'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BookOpen, TrendingUp, Code2, Trash2, Loader2 } from 'lucide-react';
import { EnrollStudentDialog } from './EnrollStudentDialog';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { StudentEnrollment } from '@lumibach/types';

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang học',
  COMPLETED: 'Hoàn thành',
  DROPPED: 'Đã rời',
  SUSPENDED: 'Tạm dừng',
};

const ENROLLMENT_STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-700 dark:text-green-400',
  COMPLETED: 'bg-blue-500/10 text-blue-400',
  DROPPED: 'bg-muted text-muted-foreground',
  SUSPENDED: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};

type Course = { id: string; name: string; slug: string };

type Props = {
  studentId: string;
  studentName: string;
  courses: Course[];
  canManage: boolean;
  initialEnrollments: StudentEnrollment[];
};

export function StudentDetailClient({
  studentId,
  studentName,
  courses,
  canManage,
  initialEnrollments,
}: Props) {
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>(initialEnrollments);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startRemove] = useTransition();

  function handleEnrolled(courseId: string, courseName: string, courseSlug: string) {
    const newEnrollment: StudentEnrollment = {
      id: `optimistic-${Date.now()}`,
      courseId,
      courseName,
      courseSlug,
      status: 'ACTIVE',
      progress: 0,
      enrolledAt: new Date().toISOString(),
      quizScore: null,
      codeScore: null,
    };
    setEnrollments((prev) => [newEnrollment, ...prev]);
  }

  function handleRemove(enrollmentId: string) {
    setRemovingId(enrollmentId);
    startRemove(async () => {
      try {
        await apiClient.delete(`/enrollments/${enrollmentId}`);
        toast.success('Đã xóa học sinh khỏi khoá học.');
        setEnrollments((prev) => prev.filter((e) => e.id !== enrollmentId));
        setRemovingId(null);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xóa');
        setRemovingId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="text-muted-foreground h-4 w-4" />
          <h2 className="text-base font-semibold">
            Khóa học đang tham gia
            <span className="bg-muted text-muted-foreground ml-2 rounded-full px-2 py-0.5 text-xs font-normal">
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
        <div className="border-border bg-card rounded-xl border py-10 text-center">
          <p className="text-muted-foreground text-sm">Học sinh chưa tham gia khóa học nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enrollments.map((e) => (
            <div key={e.id} className="border-border bg-card space-y-3 rounded-xl border px-4 py-4">
              {/* Course name + status */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/courses/${e.courseSlug}`}
                    className="hover:text-primary font-medium transition-colors"
                  >
                    {e.courseName}
                  </Link>
                  <span
                    className={cn(
                      'ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      ENROLLMENT_STATUS_CLASS[e.status] ?? 'bg-muted text-muted-foreground'
                    )}
                  >
                    {ENROLLMENT_STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleRemove(e.id)}
                    disabled={removingId === e.id}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50"
                  >
                    {removingId === e.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Xóa khỏi lớp
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Tiến độ
                  </span>
                  <span className="font-medium">{Math.round(e.progress * 100)}%</span>
                </div>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(e.progress * 100)}%` }}
                  />
                </div>
              </div>

              {/* Scores */}
              <div className="flex flex-wrap gap-4 text-sm">
                {e.quizScore != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">Quiz:</span>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        e.quizScore >= 8
                          ? 'text-green-600 dark:text-green-400'
                          : e.quizScore >= 5
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-destructive'
                      )}
                    >
                      {e.quizScore}/10
                    </span>
                  </div>
                )}
                {e.codeScore != null && (
                  <div className="flex items-center gap-1.5">
                    <Code2 className="text-muted-foreground h-3.5 w-3.5" />
                    <span className="text-muted-foreground text-xs">Code:</span>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        e.codeScore >= 8
                          ? 'text-green-600 dark:text-green-400'
                          : e.codeScore >= 5
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-destructive'
                      )}
                    >
                      {e.codeScore}/10
                    </span>
                  </div>
                )}
                {e.quizScore == null && e.codeScore == null && (
                  <span className="text-muted-foreground text-xs italic">Chưa có điểm</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
