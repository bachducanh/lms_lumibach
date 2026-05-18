import { z } from 'zod';

/**
 * Zod schemas + types cho notifications module.
 *
 * Notification.createdAt: ISO datetime string (BE Date → JSON.stringify).
 */

export const NotificationTypeSchema = z.enum([
  'QUIZ_GRADED',
  'ASSIGNMENT_GRADED',
  'CODE_GRADED',
  'COURSE_ENROLLED',
  'ASSIGNMENT_DUE_SOON',
  'ANNOUNCEMENT',
  'FORUM_REPLY',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationItemSchema = z.object({
  id: z.string(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
});
export type NotificationItem = z.infer<typeof NotificationItemSchema>;

export const NotificationListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

export const UnreadCountSchema = z.object({
  count: z.number().int().nonnegative(),
});
export type UnreadCount = z.infer<typeof UnreadCountSchema>;

export const NotificationPrefsSchema = z.object({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  emailQuizGraded: z.boolean(),
  emailAssignmentGraded: z.boolean(),
  emailCodeGraded: z.boolean(),
  emailEnrolled: z.boolean(),
  emailDueSoon: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>;

/** PUT /notifications/preferences body — chấp nhận update partial. */
export const NotificationPrefsUpdateSchema = NotificationPrefsSchema.partial();
export type NotificationPrefsUpdate = z.infer<typeof NotificationPrefsUpdateSchema>;
