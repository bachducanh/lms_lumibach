import { cookies } from 'next/headers';
import Link from 'next/link';
import { Mail, Send } from 'lucide-react';
import { prisma } from '@/lib/db';
import { apiServerClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { sendParticipationReminderAction } from './actions';
import type { CourseDetail } from '@lumibach/types';
import type { ActivityAction, ModuleItemType } from '@lumibach/db';

export const metadata = { title: 'Tham gia khóa học - Khóa học' };
export const dynamic = 'force-dynamic';

type ResourceOption = {
  key: string;
  moduleName: string;
  title: string;
  type: ModuleItemType;
  resourceId: string;
  href: string;
};

type ParticipationRow = {
  id: string;
  name: string;
  email: string;
  viewedAt: Date | null;
  interactedAt: Date | null;
  status: 'viewed' | 'interacted' | 'not-viewed';
};

const TYPE_LABEL: Record<string, string> = {
  LESSON: 'Bài giảng',
  ASSIGNMENT: 'Bài tập',
  QUIZ: 'Quiz',
  CODE_EXERCISE: 'Bài code',
  EXTERNAL_URL: 'Link ngoài',
  FILE: 'File',
};

const VIEW_ACTIONS_BY_TYPE: Partial<Record<ModuleItemType, ActivityAction[]>> = {
  LESSON: ['VIEW_LESSON'],
  ASSIGNMENT: ['VIEW_ASSIGNMENT'],
  QUIZ: ['START_QUIZ'],
  CODE_EXERCISE: ['VIEW_EXERCISE'],
};

export default async function CourseParticipationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`);

  const modules = await prisma.module.findMany({
    where: { courseId: course.id },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      name: true,
      items: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          type: true,
          lessonId: true,
          assignmentId: true,
          quizId: true,
          codeExerciseId: true,
        },
      },
    },
  });

  const options = buildResourceOptions(modules, slug);
  const selectedKey = stringParam(sp.resource) || options[0]?.key || '';
  const selected = options.find((option) => option.key === selectedKey) ?? options[0] ?? null;
  const status = stringParam(sp.status);
  const reminded = stringParam(sp.reminded);
  const error = stringParam(sp.error);

  const rows = selected ? await getParticipationRows(course.id, selected) : [];
  const filteredRows = rows.filter((row) => {
    if (!status) return true;
    if (status === 'not-viewed') return row.status === 'not-viewed';
    if (status === 'viewed') return row.status === 'viewed' || row.status === 'interacted';
    if (status === 'interacted') return row.status === 'interacted';
    return true;
  });
  const notCompletedRows = rows.filter((row) => row.status === 'not-viewed');
  const viewedCount = rows.filter(
    (row) => row.status === 'viewed' || row.status === 'interacted'
  ).length;
  const interactedCount = rows.filter((row) => row.status === 'interacted').length;
  const mailtoHref = buildMailtoHref(course.name, selected, notCompletedRows);

  return (
    <div className="space-y-5">
      <form className="border-border bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1">
          <label className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
            Tài liệu / bài tập
          </label>
          <select
            name="resource"
            defaultValue={selected?.key ?? ''}
            className="border-input bg-background h-10 min-w-[320px] rounded-lg border px-3 text-sm"
          >
            {options.length === 0 && <option value="">Chưa có nội dung</option>}
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.moduleName} / {option.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
            Trạng thái
          </label>
          <select
            name="status"
            defaultValue={status}
            className="border-input bg-background h-10 min-w-[180px] rounded-lg border px-3 text-sm"
          >
            <option value="">Tất cả</option>
            <option value="viewed">Đã xem</option>
            <option value="interacted">Đã tương tác</option>
            <option value="not-viewed">Chưa xem</option>
          </select>
        </div>
        <button type="submit" className={buttonVariants()}>
          Get participation
        </button>
      </form>

      {reminded && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          Đã tạo nhắc nhở cho {Number(reminded).toLocaleString('vi-VN')} học viên.
        </div>
      )}
      {error === 'forbidden' && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
          Bạn không có quyền gửi nhắc nhở cho khóa học này.
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <SummaryCard label="Tổng học viên" value={String(rows.length)} />
          <SummaryCard label="Đã xem" value={String(viewedCount)} />
          <SummaryCard label="Đã tương tác" value={String(interactedCount)} />
          <SummaryCard
            label="Chưa xem"
            value={String(notCompletedRows.length)}
            tone="text-amber-500"
          />
        </div>
      )}

      {selected && (
        <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{TYPE_LABEL[selected.type] ?? selected.type}</Badge>
              <Link
                href={selected.href}
                className="hover:text-primary font-medium transition-colors"
              >
                {selected.title}
              </Link>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">{selected.moduleName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={mailtoHref}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              aria-disabled={notCompletedRows.length === 0}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Email BCC
            </a>
            <form action={sendParticipationReminderAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="resource" value={selected.key} />
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                disabled={notCompletedRows.length === 0}
                className={buttonVariants({ size: 'sm' })}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Gửi nhắc nhở hàng loạt
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-border bg-muted/30 border-b text-left text-xs">
            <tr>
              <Th>Học viên</Th>
              <Th>Email</Th>
              <Th>Trạng thái</Th>
              <Th>Lần xem gần nhất</Th>
              <Th>Lần tương tác gần nhất</Th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-8 text-center">
                  Không có học viên nào khớp bộ lọc.
                </td>
              </tr>
            )}
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-border/50 hover:bg-muted/20 border-b">
                <Td>
                  <p className="font-medium">{row.name}</p>
                </Td>
                <Td>
                  <span className="text-muted-foreground">{row.email}</span>
                </Td>
                <Td>
                  <StatusBadge status={row.status} />
                </Td>
                <Td>{formatDate(row.viewedAt)}</Td>
                <Td>{formatDate(row.interactedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildResourceOptions(
  modules: {
    name: string;
    items: {
      title: string;
      type: ModuleItemType;
      lessonId: string | null;
      assignmentId: string | null;
      quizId: string | null;
      codeExerciseId: string | null;
    }[];
  }[],
  slug: string
): ResourceOption[] {
  return modules.flatMap((module) =>
    module.items
      .map((item) => {
        const resourceId = item.lessonId ?? item.assignmentId ?? item.quizId ?? item.codeExerciseId;
        if (!resourceId || !VIEW_ACTIONS_BY_TYPE[item.type]) return null;
        return {
          key: `${item.type}:${resourceId}`,
          moduleName: module.name,
          title: item.title,
          type: item.type,
          resourceId,
          href: resourceHref(slug, item.type, resourceId),
        };
      })
      .filter((option): option is ResourceOption => Boolean(option))
  );
}

async function getParticipationRows(courseId: string, selected: ResourceOption) {
  const [students, viewLogs, interactions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, status: 'ACTIVE', user: { role: 'STUDENT' } },
      select: {
        userId: true,
        user: {
          select: {
            fullName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ user: { fullName: 'asc' } }, { user: { email: 'asc' } }],
    }),
    prisma.activityLog.findMany({
      where: {
        courseId,
        resourceId: selected.resourceId,
        action: { in: VIEW_ACTIONS_BY_TYPE[selected.type] ?? [] },
      },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, createdAt: true },
    }),
    getInteractions(selected),
  ]);

  const viewedAtByUser = new Map<string, Date>();
  for (const log of viewLogs) {
    if (!viewedAtByUser.has(log.userId)) viewedAtByUser.set(log.userId, log.createdAt);
  }

  const rows: ParticipationRow[] = students.map(({ userId, user }) => {
    const viewedAt = viewedAtByUser.get(userId) ?? null;
    const interactedAt = interactions.get(userId) ?? null;
    const status: ParticipationRow['status'] = interactedAt
      ? 'interacted'
      : viewedAt
        ? 'viewed'
        : 'not-viewed';

    return {
      id: userId,
      name: displayUserName(user),
      email: user.email,
      viewedAt,
      interactedAt,
      status,
    };
  });

  return rows;
}

async function getInteractions(selected: ResourceOption) {
  const result = new Map<string, Date>();

  if (selected.type === 'ASSIGNMENT') {
    const rows = await prisma.submission.findMany({
      where: { assignmentId: selected.resourceId, submittedAt: { not: null } },
      orderBy: { submittedAt: 'desc' },
      select: { studentId: true, submittedAt: true },
    });
    for (const row of rows) {
      if (row.submittedAt && !result.has(row.studentId)) result.set(row.studentId, row.submittedAt);
    }
  }

  if (selected.type === 'QUIZ') {
    const rows = await prisma.quizAttempt.findMany({
      where: { quizId: selected.resourceId },
      orderBy: [{ submittedAt: 'desc' }, { startedAt: 'desc' }],
      select: { studentId: true, submittedAt: true, startedAt: true },
    });
    for (const row of rows) {
      const date = row.submittedAt ?? row.startedAt;
      if (!result.has(row.studentId)) result.set(row.studentId, date);
    }
  }

  if (selected.type === 'CODE_EXERCISE') {
    const rows = await prisma.codeSubmission.findMany({
      where: { codeExerciseId: selected.resourceId },
      orderBy: { submittedAt: 'desc' },
      select: { studentId: true, submittedAt: true },
    });
    for (const row of rows) {
      if (!result.has(row.studentId)) result.set(row.studentId, row.submittedAt);
    }
  }

  return result;
}

function buildMailtoHref(
  courseName: string,
  selected: ResourceOption | null,
  rows: ParticipationRow[]
) {
  const bcc = rows.map((row) => row.email).join(',');
  const subject = selected ? `Nhắc học: ${selected.title}` : `Nhắc học: ${courseName}`;
  const body = selected
    ? `Bạn chưa xem hoặc hoàn thành "${selected.title}" trong khóa ${courseName}.`
    : `Bạn có nội dung cần hoàn thành trong khóa ${courseName}.`;
  return `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function resourceHref(slug: string, type: ModuleItemType, resourceId: string) {
  switch (type) {
    case 'LESSON':
      return `/courses/${slug}/lessons/${resourceId}`;
    case 'ASSIGNMENT':
      return `/courses/${slug}/assignments/${resourceId}`;
    case 'QUIZ':
      return `/courses/${slug}/quizzes/${resourceId}`;
    case 'CODE_EXERCISE':
      return `/courses/${slug}/exercises/${resourceId}`;
    default:
      return `/courses/${slug}/modules`;
  }
}

function stringParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : '';
}

function displayUserName(user: {
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
}) {
  return (user.fullName ?? `${user.firstName} ${user.lastName}`.trim()) || user.email;
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleString('vi-VN') : '-';
}

function StatusBadge({ status }: { status: ParticipationRow['status'] }) {
  if (status === 'interacted') return <Badge variant="success">Đã tương tác</Badge>;
  if (status === 'viewed') return <Badge variant="outline">Đã xem</Badge>;
  return <Badge variant="warning">Chưa xem</Badge>;
}

function SummaryCard({
  label,
  value,
  tone = 'text-primary',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="border-border bg-card rounded-lg border px-4 py-3">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-muted-foreground px-3 py-2.5 font-semibold whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 align-top">{children}</td>;
}
