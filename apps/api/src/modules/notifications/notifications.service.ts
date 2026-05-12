import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaClient } from '@lumibach/db';
import type {
  NotificationItem,
  NotificationListQuery,
  NotificationPrefs,
  NotificationPrefsUpdate,
  UnreadCount,
} from '@lumibach/types';

const DEFAULT_PREFS: NotificationPrefs = {
  inAppEnabled: true,
  emailEnabled: true,
  emailQuizGraded: true,
  emailAssignmentGraded: true,
  emailCodeGraded: true,
  emailEnrolled: true,
  emailDueSoon: true,
};

const LIST_TTL_MS = 30_000;
const UNREAD_TTL_MS = 10_000;
const PREFS_TTL_MS = 60_000;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  async list(userId: string, query: NotificationListQuery): Promise<NotificationItem[]> {
    return this.cached(`notifications:list:${userId}:${query.limit}`, LIST_TTL_MS, async () => {
      const rows = await this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          isRead: true,
          createdAt: true,
        },
      });
      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        link: r.link,
        isRead: r.isRead,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  async unreadCount(userId: string): Promise<UnreadCount> {
    return this.cached(`notifications:unread:${userId}`, UNREAD_TTL_MS, async () => {
      const count = await this.prisma.notification.count({
        where: { userId, isRead: false },
      });
      return { count };
    });
  }

  async markRead(userId: string, notificationId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    await this.invalidateUserCaches(userId);
    return { updated: result.count };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    await this.invalidateUserCaches(userId);
    return { updated: result.count };
  }

  async getPrefs(userId: string): Promise<NotificationPrefs> {
    return this.cached(`notifications:prefs:${userId}`, PREFS_TTL_MS, async () => {
      const pref = await this.prisma.notificationPreference.findUnique({
        where: { userId },
      });
      if (!pref) return DEFAULT_PREFS;
      return {
        inAppEnabled: pref.inAppEnabled,
        emailEnabled: pref.emailEnabled,
        emailQuizGraded: pref.emailQuizGraded,
        emailAssignmentGraded: pref.emailAssignmentGraded,
        emailCodeGraded: pref.emailCodeGraded,
        emailEnrolled: pref.emailEnrolled,
        emailDueSoon: pref.emailDueSoon,
      };
    });
  }

  async savePrefs(userId: string, prefs: NotificationPrefsUpdate): Promise<NotificationPrefs> {
    const saved = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...prefs },
      update: prefs,
    });
    await this.cache.del(`notifications:prefs:${userId}`);
    return {
      inAppEnabled: saved.inAppEnabled,
      emailEnabled: saved.emailEnabled,
      emailQuizGraded: saved.emailQuizGraded,
      emailAssignmentGraded: saved.emailAssignmentGraded,
      emailCodeGraded: saved.emailCodeGraded,
      emailEnrolled: saved.emailEnrolled,
      emailDueSoon: saved.emailDueSoon,
    };
  }

  // ── Internals ──────────────────────────────────────────────────

  private async invalidateUserCaches(userId: string): Promise<void> {
    // List cache phụ thuộc `limit` — invalidate vài size phổ biến (20, 50).
    // Pattern delete không universal trong cache-manager; chấp nhận sự đơn giản.
    await Promise.all([
      this.cache.del(`notifications:unread:${userId}`),
      this.cache.del(`notifications:list:${userId}:20`),
      this.cache.del(`notifications:list:${userId}:50`),
      this.cache.del(`notifications:list:${userId}:100`),
    ]);
  }

  private async cached<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    if (process.env.NODE_ENV === 'test') return factory();
    const hit = await this.cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
    const fresh = await factory();
    await this.cache.set(key, fresh, ttlMs);
    return fresh;
  }
}
