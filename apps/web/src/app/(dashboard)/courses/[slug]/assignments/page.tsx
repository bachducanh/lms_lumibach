import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { apiServerClient } from '@/lib/api-client';
import type { CourseDetail, AssignmentsByModule, AssignmentListItem } from '@lumibach/types';
import type { CodeExerciseListItem, ExerciseModuleGroup } from '@lumibach/types';
import type { PracticeTestsByModule, PracticeTestListItem } from '@lumibach/types';
import { hasMinRole } from '@/lib/permissions';
import {
  ClipboardList,
  Clock,
  FileText,
  Paperclip,
  AlignLeft,
  BookOpen,
  FolderOpen,
  Code2,
  FileQuestion,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Bài tập' };

// ── Assignment helpers ────────────────────────────────────────

const TYPE_LABEL: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  TEXT: { label: 'Văn bản', icon: AlignLeft },
  FILE: { label: 'File', icon: Paperclip },
  BOTH: { label: 'VB + File', icon: FileText },
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-green-500/10 text-green-700 dark:text-green-400',
  CLOSED: 'bg-destructive/10 text-destructive',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đã đăng',
  CLOSED: 'Đã đóng',
};

const EX_STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-green-500/10 text-green-700 dark:text-green-400',
  CLOSED: 'bg-destructive/10 text-destructive',
};

const LANG_LABEL: Record<string, string> = {
  PYTHON3: 'Python 3',
  JAVASCRIPT: 'JavaScript',
  CPP17: 'C++ 17',
  WEB: 'Web',
};

function formatDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

// ── Cards ──────────────────────────────────────────────────────

function AssignmentCard({
  a,
  slug,
  isStaff,
}: {
  a: AssignmentListItem;
  slug: string;
  isStaff: boolean;
}) {
  const TypeIcon = TYPE_LABEL[a.type]?.icon ?? FileText;
  const isOverdue = a.dueDate && new Date() > new Date(a.dueDate);

  return (
    <Link
      href={`/courses/${slug}/assignments/${a.id}`}
      className="border-border bg-card hover:bg-accent/40 flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
        <TypeIcon className="h-5 w-5 text-blue-500" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{a.title}</p>
          {isStaff && (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_CLASS[a.status]
              )}
            >
              {STATUS_LABEL[a.status]}
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span>{TYPE_LABEL[a.type]?.label}</span>
          <span>·</span>
          <span>{a.maxScore} điểm</span>
          {a.dueDate && (
            <>
              <span>·</span>
              <span
                className={cn(
                  'flex items-center gap-1',
                  isOverdue && a.status === 'PUBLISHED' ? 'text-destructive' : ''
                )}
              >
                <Clock className="h-3 w-3" />
                {formatDate(a.dueDate)}
              </span>
            </>
          )}
          {isStaff && (
            <>
              <span>·</span>
              <span>{a._count.submissions} bài nộp</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function ExerciseCard({
  ex,
  slug,
  isStaff,
}: {
  ex: CodeExerciseListItem;
  slug: string;
  isStaff: boolean;
}) {
  return (
    <Link
      href={`/courses/${slug}/exercises/${ex.id}`}
      className="bg-card flex items-center gap-4 rounded-xl border border-violet-500/20 px-5 py-4 transition-colors hover:bg-violet-500/5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
        <Code2 className="h-5 w-5 text-violet-500" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{ex.title}</p>
          <span className="shrink-0 rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-xs font-medium text-violet-400">
            {LANG_LABEL[ex.language] ?? ex.language}
          </span>
          {isStaff && (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                EX_STATUS_CLASS[ex.status]
              )}
            >
              {STATUS_LABEL[ex.status]}
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span>Bài tập code</span>
          {isStaff && (
            <>
              <span>·</span>
              <span>{ex._count.submissions} bài nộp</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function PracticeTestCard({
  pt,
  slug,
  isStaff,
}: {
  pt: PracticeTestListItem;
  slug: string;
  isStaff: boolean;
}) {
  const isOverdue = pt.dueDate && new Date() > new Date(pt.dueDate);

  return (
    <Link
      href={`/courses/${slug}/practice-tests/${pt.id}`}
      className="bg-card flex items-center gap-4 rounded-xl border border-cyan-500/20 px-5 py-4 transition-colors hover:bg-cyan-500/5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
        <FileQuestion className="h-5 w-5 text-cyan-500" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{pt.title}</p>
          <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-xs font-medium text-cyan-500">
            Đề PDF
          </span>
          {isStaff && (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_CLASS[pt.status]
              )}
            >
              {STATUS_LABEL[pt.status]}
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            {pt._count.questions} câu
          </span>
          {pt.timeLimit && (
            <>
              <span>·</span>
              <span>{pt.timeLimit} phút</span>
            </>
          )}
          {pt.dueDate && (
            <>
              <span>·</span>
              <span
                className={cn(
                  'flex items-center gap-1',
                  isOverdue && pt.status === 'PUBLISHED' ? 'text-destructive' : ''
                )}
              >
                <Clock className="h-3 w-3" />
                {formatDate(pt.dueDate)}
              </span>
            </>
          )}
          {isStaff && (
            <>
              <span>·</span>
              <span>{pt._count.attempts} bài làm</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default async function AssignmentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`).catch(() => null);
  if (!course) notFound();
  if (!role) redirect('/login');

  const isStaff = hasMinRole(role, 'TA');

  const [
    { groups: aGroups, standalone: aStandalone },
    { groups: eGroups, standalone: eStandalone },
    { groups: pGroups, standalone: pStandalone },
  ] = await Promise.all([
    api.get<AssignmentsByModule>('/assignments', { query: { courseId: course.id } }),
    api
      .get<{ groups: ExerciseModuleGroup[]; standalone: CodeExerciseListItem[] }>(
        '/code-exercises/by-module',
        { query: { courseId: course.id } }
      )
      .then((r) => ({ groups: r.groups, standalone: r.standalone }))
      .catch(() => ({
        groups: [] as ExerciseModuleGroup[],
        standalone: [] as CodeExerciseListItem[],
      })),
    api
      .get<PracticeTestsByModule>('/practice-tests', { query: { courseId: course.id } })
      .then((r) => ({ groups: r.groups, standalone: r.standalone }))
      .catch(() => ({
        groups: [] as PracticeTestsByModule['groups'],
        standalone: [] as PracticeTestListItem[],
      })),
  ]);

  // Merge module groups: combine assignments + exercises + practice tests per module
  const allModuleIds = [
    ...new Set([
      ...aGroups.map((g) => g.moduleId),
      ...eGroups.map((g) => g.moduleId),
      ...pGroups.map((g) => g.moduleId),
    ]),
  ];

  type MergedGroup = {
    moduleId: string;
    moduleName: string;
    position: number;
    assignments: AssignmentListItem[];
    exercises: CodeExerciseListItem[];
    practiceTests: PracticeTestListItem[];
  };

  const mergedGroups: MergedGroup[] = allModuleIds
    .map((moduleId) => {
      const ag = aGroups.find((g) => g.moduleId === moduleId);
      const eg = eGroups.find((g) => g.moduleId === moduleId);
      const pg = pGroups.find((g) => g.moduleId === moduleId);
      return {
        moduleId,
        moduleName: ag?.moduleName ?? eg?.moduleName ?? pg?.moduleName ?? '',
        position: ag?.position ?? eg?.position ?? pg?.position ?? 0,
        assignments: ag?.assignments ?? [],
        exercises: eg?.exercises ?? [],
        practiceTests: pg?.practiceTests ?? [],
      };
    })
    .sort((a, b) => a.position - b.position);

  const totalItems =
    mergedGroups.reduce(
      (s, g) => s + g.assignments.length + g.exercises.length + g.practiceTests.length,
      0
    ) +
    aStandalone.length +
    eStandalone.length +
    pStandalone.length;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
          <ClipboardList className="h-4 w-4 text-blue-500" />
          <span>{course.name}</span>
        </div>
        <h1 className="text-2xl font-bold">Bài tập &amp; Lập trình</h1>
        {totalItems > 0 && (
          <p className="text-muted-foreground mt-0.5 text-sm">
            {aGroups.reduce((s, g) => s + g.assignments.length, 0) + aStandalone.length} bài tập ·{' '}
            {eGroups.reduce((s, g) => s + g.exercises.length, 0) + eStandalone.length} bài code ·{' '}
            {pGroups.reduce((s, g) => s + g.practiceTests.length, 0) + pStandalone.length} đề luyện
            tập
          </p>
        )}
      </div>

      {totalItems === 0 ? (
        <div className="border-border bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-16 text-center">
          <ClipboardList className="text-muted-foreground/30 h-10 w-10" />
          <p className="text-muted-foreground font-medium">Chưa có bài tập nào</p>
          {isStaff && (
            <p className="text-muted-foreground/60 text-xs">
              Thêm bài tập qua mục "Thêm hoạt động và tài nguyên" trong từng chương.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Groups by module */}
          {mergedGroups.map((group) => (
            <div key={group.moduleId} className="space-y-2">
              <div className="bg-primary/5 border-primary/10 flex items-center gap-2.5 rounded-lg border px-4 py-2.5">
                <BookOpen className="text-primary h-4 w-4 shrink-0" />
                <span className="text-primary text-sm font-semibold">{group.moduleName}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {group.assignments.length + group.exercises.length + group.practiceTests.length}{' '}
                  hoạt động
                </span>
              </div>
              {group.assignments.map((a) => (
                <AssignmentCard key={a.id} a={a} slug={slug} isStaff={isStaff} />
              ))}
              {group.practiceTests.map((pt) => (
                <PracticeTestCard key={pt.id} pt={pt} slug={slug} isStaff={isStaff} />
              ))}
              {group.exercises.map((ex) => (
                <ExerciseCard key={ex.id} ex={ex} slug={slug} isStaff={isStaff} />
              ))}
            </div>
          ))}

          {/* Standalone — chỉ staff thấy, học sinh không thấy */}
          {isStaff &&
            (aStandalone.length > 0 || eStandalone.length > 0 || pStandalone.length > 0) && (
              <div className="space-y-2">
                <div className="bg-muted/40 border-border flex items-center gap-2.5 rounded-lg border px-4 py-2.5">
                  <FolderOpen className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground text-sm font-semibold">
                    Chưa thuộc chương nào
                  </span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {aStandalone.length + eStandalone.length + pStandalone.length} hoạt động
                  </span>
                </div>
                {aStandalone.map((a) => (
                  <AssignmentCard key={a.id} a={a} slug={slug} isStaff={isStaff} />
                ))}
                {pStandalone.map((pt) => (
                  <PracticeTestCard key={pt.id} pt={pt} slug={slug} isStaff={isStaff} />
                ))}
                {eStandalone.map((ex) => (
                  <ExerciseCard key={ex.id} ex={ex} slug={slug} isStaff={isStaff} />
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
