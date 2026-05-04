'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import type { ActionResult } from './auth';

const db = prisma as any;

export type NotificationItem = {
  id:        string;
  type:      string;
  title:     string;
  body:      string | null;
  link:      string | null;
  isRead:    boolean;
  createdAt: Date;
};

export type NotificationPrefs = {
  inAppEnabled:          boolean;
  emailEnabled:          boolean;
  emailQuizGraded:       boolean;
  emailAssignmentGraded: boolean;
  emailCodeGraded:       boolean;
  emailEnrolled:         boolean;
  emailDueSoon:          boolean;
};

// ── Lấy danh sách thông báo ─────────────────────────────────

export async function getNotificationsAction(limit = 20): Promise<NotificationItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const rows = await db.notification.findMany({
    where:   { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take:    limit,
    select: {
      id: true, type: true, title: true, body: true,
      link: true, isRead: true, createdAt: true,
    },
  });
  return rows as NotificationItem[];
}

// ── Đếm chưa đọc ─────────────────────────────────────────────

export async function getUnreadCountAction(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  return db.notification.count({
    where: { userId: session.user.id, isRead: false },
  });
}

// ── Đánh dấu đã đọc ──────────────────────────────────────────

export async function markReadAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  await db.notification.updateMany({
    where: { id, userId: session.user.id },
    data:  { isRead: true },
  });
  return { success: true, message: 'Đã đọc.' };
}

export async function markAllReadAction(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  await db.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data:  { isRead: true },
  });
  return { success: true, message: 'Đã đọc tất cả.' };
}

// ── Preferences ───────────────────────────────────────────────

export async function getNotificationPrefsAction(): Promise<NotificationPrefs> {
  const session = await auth();
  const defaults: NotificationPrefs = {
    inAppEnabled: true, emailEnabled: true,
    emailQuizGraded: true, emailAssignmentGraded: true,
    emailCodeGraded: true, emailEnrolled: true, emailDueSoon: true,
  };
  if (!session?.user?.id) return defaults;

  const pref = await db.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });
  return pref ? (pref as NotificationPrefs) : defaults;
}

export async function saveNotificationPrefsAction(
  prefs: Partial<NotificationPrefs>,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  await db.notificationPreference.upsert({
    where:  { userId: session.user.id },
    create: { userId: session.user.id, ...prefs },
    update: prefs,
  });
  return { success: true, message: 'Đã lưu cài đặt.' };
}
