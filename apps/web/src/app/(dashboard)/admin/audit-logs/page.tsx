import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HelpCircle, Radio, ScrollText } from 'lucide-react';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { buttonVariants } from '@/components/ui/button';
import { LiveLogsClient } from '@/components/features/activity/LiveLogsClient';
import { cn } from '@/lib/utils';
import {
  describeActivityLog,
  getActionLabel,
  getComponentLabel,
  getEventContext,
} from '@/lib/activity-labels';
import type { ActivityAction, Prisma, UserRole } from '@lumibach/db';

export const metadata = { title: 'Nhật ký hoạt động' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;
const SITE_NAME = 'LMS FOR LUMIBACH';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE_USER: 'User created',
  UPDATE_USER: 'User updated',
  DELETE_USER: 'User deleted',
  RESET_PASSWORD: 'Password reset',
  IMPORT_USERS: 'Users imported',
  REGISTER: 'User registered',
  VERIFY_EMAIL: 'Email verified',
  CHANGE_PASSWORD: 'Password changed',
  ASSIGN_TA: 'Teaching assistant assigned',
  COURSE_UPDATE: 'Course updated',
  COURSE_CREATE: 'Course created',
  COURSE_DELETE: 'Course deleted',
  ENROLL_USER: 'User enrolled',
  LOGIN_FAILED: 'Login failed',
};

const ACTIVITY_ACTIONS: ActivityAction[] = [
  'VIEW_COURSE',
  'VIEW_LESSON',
  'VIEW_ASSIGNMENT',
  'VIEW_EXERCISE',
  'START_QUIZ',
  'SUBMIT_QUIZ',
  'SUBMIT_ASSIGNMENT',
  'SUBMIT_CODE',
  'LOGIN',
];

const ACTION_GROUPS: Record<string, ActivityAction[]> = {
  view: ['VIEW_COURSE', 'VIEW_LESSON', 'VIEW_ASSIGNMENT', 'VIEW_EXERCISE'],
  submit: ['SUBMIT_ASSIGNMENT', 'SUBMIT_QUIZ', 'SUBMIT_CODE'],
  quiz: ['START_QUIZ', 'SUBMIT_QUIZ'],
  login: ['LOGIN'],
};

const ACTIVITY_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'course', label: 'Course' },
  { value: 'lesson', label: 'Lesson' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'exercise', label: 'Code exercise' },
  { value: 'scratch', label: 'Scratch' },
];

type TabKey = 'logs' | 'live';

type LogRow = {
  id: string;
  course: string;
  createdAt: Date;
  userName: string;
  affectedUser: string;
  context: string;
  component: string;
  eventName: string;
  description: string;
  origin: string;
  ipAddress: string | null;
};

const TABS: { key: TabKey; label: string; icon: typeof ScrollText }[] = [
  { key: 'logs', label: 'Logs', icon: ScrollText },
  { key: 'live', label: 'Live logs', icon: Radio },
];

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (role !== 'ADMIN') redirect('/dashboard');

  const sp = await searchParams;
  const rawTab = stringParam(sp.tab) || 'logs';
  const tab: TabKey = rawTab === 'live' ? 'live' : 'logs';

  return (
    <div className="lb-stagger space-y-5">
      <div style={{ ['--i' as string]: 0 }}>
        <h1 className="text-2xl font-bold">Nhật ký hoạt động</h1>
        <p className="text-muted-foreground text-sm">
          Theo dõi lịch sử hoạt động hệ thống và hoạt động trực tiếp.
        </p>
      </div>

      <div
        className="border-border flex flex-wrap items-center gap-2 border-b pb-3"
        style={{ ['--i' as string]: 1 }}
      >
        {TABS.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === tab;
          return (
            <Link
              key={item.key}
              href={`/admin/audit-logs?tab=${item.key}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div style={{ ['--i' as string]: 2 }}>
        {tab === 'live' ? <LiveLogsClient /> : <LogsPanel searchParams={sp} />}
      </div>
    </div>
  );
}

async function LogsPanel({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const scope = stringParam(searchParams.scope) || 'site';
  const userId = stringParam(searchParams.userId);
  const day = stringParam(searchParams.day);
  const activity = stringParam(searchParams.activity);
  const actionGroup = stringParam(searchParams.action);
  const source = stringParam(searchParams.source);
  const event = stringParam(searchParams.event);
  const page = positivePage(searchParams.page);

  const [courses, users] = await Promise.all([
    prisma.course.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
      orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
      take: 500,
    }),
  ]);

  const selectedCourseId = scope !== 'site' ? scope : '';
  const selectedActions =
    event && isActivityAction(event)
      ? [event as ActivityAction]
      : actionGroup
        ? ACTION_GROUPS[actionGroup]
        : undefined;

  const dateWhere = dateRange(day);
  const shouldQueryActivity =
    source !== 'system' && (!event || isActivityAction(event)) && activity !== 'system';
  const shouldQueryAudit =
    !selectedCourseId &&
    source !== 'web' &&
    (!event || !isActivityAction(event)) &&
    (!activity || activity === 'system');
  const auditActionFilter = event || (actionGroup === 'login' ? 'LOGIN_FAILED' : '');
  const skipAuditByActionGroup = Boolean(actionGroup && actionGroup !== 'login' && !event);

  const [activityRows, auditRows] = await Promise.all([
    shouldQueryActivity
      ? prisma.activityLog.findMany({
          where: {
            ...dateWhere,
            ...(selectedCourseId ? { courseId: selectedCourseId } : {}),
            ...(userId ? { userId } : {}),
            ...(activity ? { resourceType: activity } : {}),
            ...(selectedActions ? { action: { in: selectedActions } } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            course: { select: { name: true } },
          },
        })
      : [],
    shouldQueryAudit
      ? prisma.auditLog.findMany({
          where: {
            ...dateWhere,
            ...(userId ? { userId } : {}),
            ...(auditActionFilter ? { action: auditActionFilter } : {}),
            ...(skipAuditByActionGroup ? { id: '__never__' } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
          include: {
            user: {
              select: {
                fullName: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        })
      : [],
  ]);

  const rows = [
    ...activityRows.map((row): LogRow => {
      const userName = displayUserName(row.user);
      const courseName = row.course?.name ?? SITE_NAME;
      return {
        id: `activity-${row.id}`,
        course: courseName,
        createdAt: row.createdAt,
        userName,
        affectedUser: '-',
        context: getEventContext(row.resourceName, courseName, row.resourceType),
        component: getComponentLabel(row.resourceType, row.action),
        eventName: getActionLabel(row.action),
        description: describeActivityLog({
          userName,
          userId: row.userId,
          action: row.action,
          resourceName: row.resourceName,
          courseName,
          resourceType: row.resourceType,
        }),
        origin: 'web',
        ipAddress: row.ipAddress,
      };
    }),
    ...auditRows.map((row): LogRow => {
      const userName = row.user ? displayUserName(row.user) : 'System';
      const eventName = AUDIT_ACTION_LABELS[row.action] ?? row.action;
      const context = row.resource ?? 'System';
      return {
        id: `audit-${row.id}`,
        course: SITE_NAME,
        createdAt: row.createdAt,
        userName,
        affectedUser: '-',
        context,
        component: 'System',
        eventName,
        description: `${userName} ${eventName.toLowerCase()}${row.resource ? ` (${row.resource})` : ''}.`,
        origin: 'system',
        ipAddress: row.ipAddress,
      };
    }),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function buildHref(overrides: Record<string, string>) {
    const qs = buildSearchParams(
      {
        tab: 'logs',
        scope,
        userId,
        day,
        activity,
        action: actionGroup,
        source,
        event,
        page: page > 1 ? String(page) : '',
      },
      overrides
    );
    return `/admin/audit-logs${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-5">
      <form className="space-y-3">
        <input type="hidden" name="tab" value="logs" />
        <h2 className="text-lg font-semibold">Choose which logs you want to see:</h2>
        <div className="flex flex-wrap gap-2">
          <Select name="scope" defaultValue={scope} className="min-w-[250px]">
            <option value="site">{SITE_NAME} (Site)</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </Select>
          <Select name="userId" defaultValue={userId} className="min-w-[250px]">
            <option value="">All participants</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {displayUserName(user)}
              </option>
            ))}
          </Select>
          <Select name="day" defaultValue={day} className="min-w-[190px]">
            <option value="">All days</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </Select>
          <Select name="activity" defaultValue={activity} className="min-w-[140px]">
            <option value="">All activities</option>
            {ACTIVITY_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select name="action" defaultValue={actionGroup} className="min-w-[135px]">
            <option value="">All actions</option>
            <option value="view">View</option>
            <option value="submit">Submit</option>
            <option value="quiz">Quiz</option>
            <option value="login">Login</option>
          </Select>
          <Select name="source" defaultValue={source} className="min-w-[135px]">
            <option value="">All sources</option>
            <option value="web">web</option>
            <option value="system">system</option>
          </Select>
          <Select name="event" defaultValue={event} className="min-w-[145px]">
            <option value="">All events</option>
            {ACTIVITY_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {getActionLabel(item)}
              </option>
            ))}
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <span
            className="text-muted-foreground inline-flex h-10 w-8 items-center justify-center"
            title="Course logs are also available in each course report."
          >
            <HelpCircle className="h-4 w-4" />
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={buttonVariants()}>
            Get these logs
          </button>
          {(scope !== 'site' || userId || day || activity || actionGroup || source || event) && (
            <Link
              href="/admin/audit-logs?tab=logs"
              className={buttonVariants({ variant: 'outline' })}
            >
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <div className="text-muted-foreground text-xs">
        {total.toLocaleString('vi-VN')} events · page {page}/{totalPages}
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="border-border bg-muted/30 border-b text-left text-xs">
            <tr>
              <Th>Course</Th>
              <Th>Time</Th>
              <Th>User full name</Th>
              <Th>Affected user</Th>
              <Th>Event context</Th>
              <Th>Component</Th>
              <Th>Event name</Th>
              <Th>Description</Th>
              <Th>Origin</Th>
              <Th>IP address</Th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-muted-foreground p-8 text-center">
                  Không có nhật ký nào khớp bộ lọc.
                </td>
              </tr>
            )}
            {pageRows.map((row) => (
              <tr key={row.id} className="border-border/50 hover:bg-muted/20 border-b">
                <Td>{row.course}</Td>
                <Td>
                  <span className="whitespace-nowrap">{formatLogTime(row.createdAt)}</span>
                </Td>
                <Td>{row.userName}</Td>
                <Td>{row.affectedUser}</Td>
                <Td>
                  <span className="text-primary">{row.context}</span>
                </Td>
                <Td>{row.component}</Td>
                <Td>
                  <span className="text-primary">{row.eventName}</span>
                </Td>
                <Td>{row.description}</Td>
                <Td>{row.origin}</Td>
                <Td>
                  <span className="text-primary font-mono text-xs">{row.ipAddress ?? '-'}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildHref({ page: String(page - 1) })}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Previous
            </Link>
          )}
          <span className="text-muted-foreground text-sm">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildHref({ page: String(page + 1) })}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function isActivityAction(value: string): value is ActivityAction {
  return ACTIVITY_ACTIONS.includes(value as ActivityAction);
}

function stringParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : '';
}

function positivePage(value: string | string[] | undefined): number {
  if (typeof value !== 'string') return 1;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function dateRange(day: string): Prisma.ActivityLogWhereInput & Prisma.AuditLogWhereInput {
  if (!day) return {};
  const now = new Date();
  if (day === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { createdAt: { gte: start, lte: end } };
  }
  if (day === '7d' || day === '30d') {
    const days = day === '7d' ? 7 : 30;
    const start = new Date(now);
    start.setDate(now.getDate() - days);
    return { createdAt: { gte: start } };
  }
  return {};
}

function buildSearchParams(
  current: Record<string, string>,
  overrides: Record<string, string>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}

function displayUserName(user: {
  fullName: string | null;
  firstName: string;
  lastName?: string | null;
  email: string;
}) {
  return (user.fullName ?? `${user.firstName} ${user.lastName ?? ''}`.trim()) || user.email;
}

function formatLogTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

function Select({
  children,
  className = '',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`border-input bg-background focus:ring-ring h-10 rounded-lg border px-3 text-sm shadow-sm focus:ring-1 focus:outline-none ${className}`}
    >
      {children}
    </select>
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
