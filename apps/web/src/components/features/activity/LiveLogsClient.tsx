'use client';

import { useEffect, useState } from 'react';
import { Activity, Loader2, Radio, Users } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  describeActivityLog,
  getActionLabel,
  getComponentLabel,
  getEventContext,
} from '@/lib/activity-labels';

type LiveLog = {
  id: string;
  userName: string;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  resourceType: string | null;
  resourceName: string | null;
  courseName: string | null;
  ipAddress: string | null;
  createdAt: string;
};

type LiveOnlineUser = {
  id: string;
  fullName: string | null;
  email: string;
  role: string;
  lastActiveAt: string;
};

type LiveSummary = {
  onlineUsers: LiveOnlineUser[];
  recentActions: LiveLog[];
  windowMinutes: number;
};

const REFRESH_MS = 10_000;

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Quản trị',
  TEACHER: 'Giáo viên',
  TA: 'Trợ giảng',
  STUDENT: 'Học sinh',
};

function relativeTime(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s trước`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  return new Date(iso).toLocaleString('vi-VN');
}

function formatLogTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

export function LiveLogsClient({ courseId }: { courseId?: string } = {}) {
  const [data, setData] = useState<LiveSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await apiClient.get<LiveSummary>('/analytics/live', {
          query: courseId ? { courseId } : undefined,
        });
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Không tải được live logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(tick);
    };
  }, [courseId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Radio
              className={cn(
                'h-4 w-4',
                loading ? 'text-muted-foreground' : 'animate-pulse text-rose-500'
              )}
            />
            Live logs
          </h2>
          <p className="text-muted-foreground text-xs">
            Cập nhật mỗi 10 giây, dữ liệu trong {data?.windowMinutes ?? 5} phút gần nhất.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {data?.onlineUsers.length ?? 0} online
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            {data?.recentActions.length ?? 0} events
          </span>
          {loading && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
        </div>
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
          {error}
        </div>
      )}

      {data && data.onlineUsers.length > 0 && (
        <div className="border-border bg-card flex flex-wrap gap-2 rounded-lg border p-3">
          {data.onlineUsers.slice(0, 8).map((u) => (
            <div
              key={u.id}
              className="border-border bg-background inline-flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
            >
              <span className="relative inline-flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="max-w-44 truncate font-medium">{u.fullName ?? u.email}</span>
              <span className="text-muted-foreground">
                {ROLE_LABEL[u.role] ?? u.role} · {relativeTime(u.lastActiveAt, now)}
              </span>
            </div>
          ))}
          {data.onlineUsers.length > 8 && (
            <span className="text-muted-foreground px-2 py-1.5 text-xs">
              +{data.onlineUsers.length - 8} người khác
            </span>
          )}
        </div>
      )}

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
            {data?.recentActions.length === 0 && (
              <tr>
                <td colSpan={10} className="text-muted-foreground p-8 text-center">
                  Chưa có hoạt động trực tiếp trong vài phút gần đây.
                </td>
              </tr>
            )}
            {data?.recentActions.map((log) => {
              const context = getEventContext(log.resourceName, log.courseName, log.resourceType);
              return (
                <tr key={log.id} className="border-border/50 hover:bg-muted/20 border-b">
                  <Td>{log.courseName ?? 'LMS FOR LUMIBACH'}</Td>
                  <Td>
                    <span className="whitespace-nowrap">{formatLogTime(log.createdAt)}</span>
                  </Td>
                  <Td>{log.userName || '-'}</Td>
                  <Td>-</Td>
                  <Td>
                    <span className="text-primary">{context}</span>
                  </Td>
                  <Td>{getComponentLabel(log.resourceType, log.action)}</Td>
                  <Td>
                    <span className="text-primary">{getActionLabel(log.action)}</span>
                  </Td>
                  <Td>
                    {describeActivityLog({
                      userName: log.userName,
                      action: log.action,
                      resourceType: log.resourceType,
                      resourceName: log.resourceName,
                      courseName: log.courseName,
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
