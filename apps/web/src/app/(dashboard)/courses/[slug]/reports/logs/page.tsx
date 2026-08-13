import * as React from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { apiServerClient } from '@/lib/api-client';
import { buttonVariants } from '@/components/ui/button';
import {
  describeActivityLog,
  getActionLabel,
  getComponentLabel,
  getEventContext,
} from '@/lib/activity-labels';
import type { CourseDetail } from '@lumibach/types';
import type { ActivityAction, Prisma } from '@lumibach/db';
import { SimpleSelect } from '@/components/ui/select';

export const metadata = { title: 'Nhật ký khoá học' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const ACTION_GROUPS: Record<string, ActivityAction[]> = {
  view: ['VIEW_COURSE', 'VIEW_LESSON', 'VIEW_ASSIGNMENT', 'VIEW_EXERCISE'],
  submit: ['SUBMIT_ASSIGNMENT', 'SUBMIT_QUIZ', 'SUBMIT_CODE'],
  quiz: ['START_QUIZ', 'SUBMIT_QUIZ'],
  login: ['LOGIN'],
};

const ACTIVITY_OPTIONS = [
  { value: 'course', label: 'Course' },
  { value: 'lesson', label: 'Lesson' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'exercise', label: 'Code exercise' },
  { value: 'scratch', label: 'Scratch' },
];

const EVENT_OPTIONS: ActivityAction[] = [
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

export default async function CourseLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const api = apiServerClient(await cookies());
  const course = await api.get<CourseDetail>(`/courses/${slug}`);

  const userId = stringParam(sp.userId);
  const day = stringParam(sp.day);
  const activity = stringParam(sp.activity);
  const actionGroup = stringParam(sp.action);
  const source = stringParam(sp.source);
  const event = stringParam(sp.event);
  const page = positivePage(sp.page);

  const selectedActions = event
    ? [event as ActivityAction]
    : actionGroup
      ? ACTION_GROUPS[actionGroup]
      : undefined;

  const where: Prisma.ActivityLogWhereInput = {
    courseId: course.id,
    ...dateRange(day),
    ...(userId ? { userId } : {}),
    ...(activity ? { resourceType: activity } : {}),
    ...(selectedActions ? { action: { in: selectedActions } } : {}),
    ...(source === 'cli' ? { id: '__never__' } : {}),
  };

  const [logs, total, participants] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        course: { select: { name: true } },
      },
    }),
    prisma.activityLog.count({ where }),
    prisma.user.findMany({
      where: {
        OR: [
          { enrollments: { some: { courseId: course.id } } },
          { ownedCourses: { some: { id: course.id } } },
          { taAssignments: { some: { courseId: course.id } } },
          { coTeachingCourses: { some: { courseId: course.id } } },
        ],
      },
      select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
      orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string>): string {
    const qs = buildSearchParams(
      {
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
    return `/courses/${slug}/reports/logs${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-5">
      <form className="space-y-3">
        <h2 className="text-lg font-semibold">Choose which logs you want to see:</h2>
        <div className="flex flex-wrap gap-2">
          <Select name="course" defaultValue={course.id} className="min-w-[250px]">
            <option value={course.id}>{course.shortName ?? course.name}</option>
          </Select>
          <Select name="group" defaultValue="" className="min-w-[125px]">
            <option value="">All groups</option>
          </Select>
          <Select name="userId" defaultValue={userId} className="min-w-[240px]">
            <option value="">All participants</option>
            {participants.map((u) => (
              <option key={u.id} value={u.id}>
                {displayUserName(u)}
              </option>
            ))}
          </Select>
          <Select name="day" defaultValue={day} className="min-w-[210px]">
            <option value="">All days</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </Select>
          <Select name="activity" defaultValue={activity} className="min-w-[230px]">
            <option value="">All activities</option>
            {ACTIVITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
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
          </Select>
          <Select name="event" defaultValue={event} className="min-w-[145px]">
            <option value="">All events</option>
            {EVENT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {getActionLabel(value)}
              </option>
            ))}
          </Select>
          <span
            className="text-muted-foreground inline-flex h-10 w-8 items-center justify-center"
            title="Course logs are scoped to this course."
          >
            <HelpCircle className="h-4 w-4" />
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={buttonVariants()}>
            Get these logs
          </button>
          {(userId || day || activity || actionGroup || source || event) && (
            <Link
              href={`/courses/${slug}/reports/logs`}
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
            {logs.length === 0 && (
              <tr>
                <td colSpan={10} className="text-muted-foreground p-8 text-center">
                  Không có nhật ký nào khớp bộ lọc.
                </td>
              </tr>
            )}
            {logs.map((log) => {
              const userName = displayUserName(log.user);
              return (
                <tr key={log.id} className="border-border/50 hover:bg-muted/20 border-b">
                  <Td>{log.course?.name ?? course.name}</Td>
                  <Td>
                    <span className="whitespace-nowrap">{formatLogTime(log.createdAt)}</span>
                  </Td>
                  <Td>{userName}</Td>
                  <Td>-</Td>
                  <Td>
                    <span className="text-primary">
                      {getEventContext(
                        log.resourceName,
                        log.course?.name ?? course.name,
                        log.resourceType
                      )}
                    </span>
                  </Td>
                  <Td>{getComponentLabel(log.resourceType, log.action)}</Td>
                  <Td>
                    <span className="text-primary">{getActionLabel(log.action)}</span>
                  </Td>
                  <Td>
                    {describeActivityLog({
                      userName,
                      userId: log.userId,
                      action: log.action,
                      resourceType: log.resourceType,
                      resourceName: log.resourceName,
                      courseName: log.course?.name ?? course.name,
                    })}
                  </Td>
                  <Td>web</Td>
                  <Td>
                    <span className="text-primary font-mono text-xs">{log.ipAddress ?? '-'}</span>
                  </Td>
                </tr>
              );
            })}
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

function stringParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function positivePage(value: string | string[] | undefined): number {
  if (typeof value !== 'string') return 1;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function dateRange(day: string): Prisma.ActivityLogWhereInput {
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

/**
 * Bộ lọc dạng dropdown của trang này.
 *
 * Vẫn nhận `<option>` làm children như thẻ select gốc, nhưng bên trong dựng
 * bằng SimpleSelect. Giữ nguyên chữ ký cũ để 8 chỗ gọi phía trên không phải
 * sửa; children được quy đổi sang danh sách {value, label}.
 */
function Select({
  children,
  className = '',
  name,
  defaultValue,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  name?: string;
  defaultValue?: string;
  'aria-label'?: string;
}) {
  const options: { value: string; label: string }[] = [];

  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement(child) || child.type !== 'option') continue;
    const props = child.props as { value?: string; children?: React.ReactNode };
    options.push({
      value: String(props.value ?? ''),
      label: nhanCuaOption(props.children),
    });
  }

  return (
    <SimpleSelect
      name={name}
      defaultValue={defaultValue}
      className={className}
      aria-label={ariaLabel ?? name}
      options={options}
    />
  );
}

/** Gộp children của một <option> thành chuỗi nhãn, kể cả khi bị chia nhiều mảnh. */
function nhanCuaOption(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
    .join('')
    .trim();
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
