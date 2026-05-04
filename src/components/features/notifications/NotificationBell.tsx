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
  QUIZ_GRADED:         '🎯',
  ASSIGNMENT_GRADED:   '📝',
  CODE_GRADED:         '💻',
  COURSE_ENROLLED:     '🎓',
  ASSIGNMENT_DUE_SOON: '⏰',
  ANNOUNCEMENT:        '📣',
};

export function NotificationBell() {
  const [open,    setOpen]    = useState(false);
  const [count,   setCount]   = useState(0);
  const [items,   setItems]   = useState<NotificationItem[]>([]);
  const [loaded,  setLoaded]  = useState(false);
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
        className="relative flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors"
        aria-label="Thông báo"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-popover shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-sm font-semibold">Thông báo</span>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                  disabled={pending}
                >
                  <CheckCheck className="h-3 w-3" />
                  Đọc tất cả
                </button>
              )}
              <Link
                href="/notifications"
                className="text-xs text-violet-500 hover:text-violet-600 transition-colors px-2 py-1 rounded-md hover:bg-muted"
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
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {loaded && items.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Không có thông báo nào
              </div>
            )}
            {loaded && items.map((n) => (
              <NotifRow key={n.id} item={n} onRead={handleMarkRead} onClose={() => setOpen(false)} />
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
  item:    NotificationItem;
  onRead:  (id: string) => void;
  onClose: () => void;
}) {
  const icon = TYPE_ICON[item.type] ?? '🔔';

  const inner = (
    <div
      className={`flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group ${!item.isRead ? 'bg-violet-500/5' : ''}`}
      onClick={() => { if (!item.isRead) onRead(item.id); }}
    >
      <span className="text-lg shrink-0 leading-none pt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!item.isRead ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
          {item.title}
        </p>
        {item.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: vi })}
        </p>
      </div>
      {!item.isRead && (
        <div className="shrink-0 flex items-start pt-1">
          <div className="h-2 w-2 rounded-full bg-violet-500" />
        </div>
      )}
    </div>
  );

  if (item.link) {
    return (
      <Link href={item.link} onClick={() => { if (!item.isRead) onRead(item.id); onClose(); }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
