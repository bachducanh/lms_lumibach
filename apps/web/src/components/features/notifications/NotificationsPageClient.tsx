'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Check, CheckCheck, Loader2 } from 'lucide-react';
import {
  getNotificationsAction,
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

const TYPE_LABEL: Record<string, string> = {
  QUIZ_GRADED: 'Quiz đã chấm',
  ASSIGNMENT_GRADED: 'Bài tập đã chấm',
  CODE_GRADED: 'Bài code đã chấm',
  COURSE_ENROLLED: 'Đăng ký khóa học',
  ASSIGNMENT_DUE_SOON: 'Sắp đến hạn',
  ANNOUNCEMENT: 'Thông báo',
};

export function NotificationsPageClient() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const rows = await getNotificationsAction(50);
      setItems(rows);
      setLoaded(true);
    });
  }, []);

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markReadAction(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    });
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllReadAction();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    });
  };

  const unreadCount = items.filter((n) => !n.isRead).length;

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">{unreadCount} thông báo chưa đọc</p>
          <button
            onClick={handleMarkAll}
            disabled={pending}
            className="flex items-center gap-1.5 text-xs text-violet-600 transition-colors hover:text-violet-700"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Đánh dấu đọc tất cả
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="border-border bg-card rounded-xl border p-12 text-center">
          <p className="mb-2 text-2xl">🔔</p>
          <p className="text-muted-foreground text-sm">Bạn chưa có thông báo nào.</p>
        </div>
      ) : (
        <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-xl border">
          {items.map((n) => (
            <NotifFullRow key={n.id} item={n} onRead={handleMarkRead} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotifFullRow({ item, onRead }: { item: NotificationItem; onRead: (id: string) => void }) {
  const icon = TYPE_ICON[item.type] ?? '🔔';
  const label = TYPE_LABEL[item.type] ?? item.type;

  const content = (
    <div
      className={`hover:bg-muted/30 flex gap-4 px-5 py-4 transition-colors ${!item.isRead ? 'bg-violet-500/5' : ''}`}
      onClick={() => {
        if (!item.isRead) onRead(item.id);
      }}
    >
      <span className="shrink-0 pt-0.5 text-xl leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            {label}
          </span>
          {!item.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />}
        </div>
        <p className={`text-sm leading-snug ${!item.isRead ? 'font-semibold' : ''}`}>
          {item.title}
        </p>
        {item.body && (
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{item.body}</p>
        )}
        <p className="text-muted-foreground/60 mt-1.5 text-[10px]">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: vi })}
        </p>
      </div>
      {!item.isRead && (
        <button
          className="hover:bg-muted text-muted-foreground shrink-0 self-center rounded-lg p-1.5 transition-colors"
          title="Đánh dấu đã đọc"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRead(item.id);
          }}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  if (item.link) {
    return (
      <Link
        href={item.link}
        className="block"
        onClick={() => {
          if (!item.isRead) onRead(item.id);
        }}
      >
        {content}
      </Link>
    );
  }
  return <div className="cursor-pointer">{content}</div>;
}
