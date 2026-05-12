'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import {
  getNotificationsAction,
  getUnreadCountAction,
  markReadAction,
  markAllReadAction,
  type NotificationItem,
} from '@/actions/notifications';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const TYPE_ICON: Record<string, string> = {
  QUIZ_GRADED: '🎯',
  ASSIGNMENT_GRADED: '📝',
  CODE_GRADED: '💻',
  COURSE_ENROLLED: '🎓',
  ASSIGNMENT_DUE_SOON: '⏰',
  ANNOUNCEMENT: '📣',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const dropRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount and every 60s
  useEffect(() => {
    const fetchCount = () => {
      startTransition(async () => {
        const n = await getUnreadCountAction();
        setCount(n);
      });
    };
    fetchCount();
    const timer = setInterval(fetchCount, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!loaded) {
      startTransition(async () => {
        const rows = await getNotificationsAction(20);
        setItems(rows);
        setLoaded(true);
      });
    }
  };

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markReadAction(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setCount((c) => Math.max(0, c - 1));
    });
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllReadAction();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setCount(0);
    });
  };

  return (
    <div className="relative" ref={dropRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="hover:bg-muted relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
        aria-label="Thông báo"
      >
        <Bell className="text-muted-foreground h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] leading-none font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="border-border bg-popover absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border shadow-lg">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Thông báo</span>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
                  disabled={pending}
                >
                  <CheckCheck className="h-3 w-3" />
                  Đọc tất cả
                </button>
              )}
              <Link
                href="/notifications"
                className="hover:bg-muted rounded-md px-2 py-1 text-xs text-violet-500 transition-colors hover:text-violet-600"
                onClick={() => setOpen(false)}
              >
                Xem tất cả
              </Link>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {!loaded && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              </div>
            )}
            {loaded && items.length === 0 && (
              <div className="text-muted-foreground py-8 text-center text-sm">
                Không có thông báo nào
              </div>
            )}
            {loaded &&
              items.map((n) => (
                <NotifRow
                  key={n.id}
                  item={n}
                  onRead={handleMarkRead}
                  onClose={() => setOpen(false)}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifRow({
  item,
  onRead,
  onClose,
}: {
  item: NotificationItem;
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  const icon = TYPE_ICON[item.type] ?? '🔔';

  const inner = (
    <div
      className={`hover:bg-muted/50 group flex cursor-pointer gap-3 px-4 py-3 transition-colors ${!item.isRead ? 'bg-violet-500/5' : ''}`}
      onClick={() => {
        if (!item.isRead) onRead(item.id);
      }}
    >
      <span className="shrink-0 pt-0.5 text-lg leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-snug ${!item.isRead ? 'text-foreground font-semibold' : 'text-foreground/80'}`}
        >
          {item.title}
        </p>
        {item.body && (
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{item.body}</p>
        )}
        <p className="text-muted-foreground/60 mt-1 text-[10px]">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: vi })}
        </p>
      </div>
      {!item.isRead && (
        <div className="flex shrink-0 items-start pt-1">
          <div className="h-2 w-2 rounded-full bg-violet-500" />
        </div>
      )}
    </div>
  );

  if (item.link) {
    return (
      <Link
        href={item.link}
        onClick={() => {
          if (!item.isRead) onRead(item.id);
          onClose();
        }}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
