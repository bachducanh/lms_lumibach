import { prisma } from './db';
import { getEmailQueue } from './queue';

export type NotificationType =
  | 'QUIZ_GRADED'
  | 'ASSIGNMENT_GRADED'
  | 'CODE_GRADED'
  | 'COURSE_ENROLLED'
  | 'ASSIGNMENT_DUE_SOON'
  | 'ANNOUNCEMENT';

type CreateParams = {
  userId: string;
  type:   NotificationType;
  title:  string;
  body?:  string;
  link?:  string;
};

type NotifPref = {
  inAppEnabled:          boolean;
  emailEnabled:          boolean;
  emailQuizGraded:       boolean;
  emailAssignmentGraded: boolean;
  emailCodeGraded:       boolean;
  emailEnrolled:         boolean;
  emailDueSoon:          boolean;
};

function isTypeEmailEnabled(pref: NotifPref | null, type: NotificationType): boolean {
  if (!pref) return true;
  switch (type) {
    case 'QUIZ_GRADED':        return pref.emailQuizGraded;
    case 'ASSIGNMENT_GRADED':  return pref.emailAssignmentGraded;
    case 'CODE_GRADED':        return pref.emailCodeGraded;
    case 'COURSE_ENROLLED':    return pref.emailEnrolled;
    case 'ASSIGNMENT_DUE_SOON':return pref.emailDueSoon;
    default:                   return true;
  }
}

export async function createNotification(params: CreateParams): Promise<void> {
  try {
    const db = prisma;

    const pref: NotifPref | null = await db.notificationPreference.findUnique({
      where: { userId: params.userId },
    });

    // Skip if in-app is disabled
    if (pref && !pref.inAppEnabled) return;

    const notif = await db.notification.create({
      data: {
        userId: params.userId,
        type:   params.type,
        title:  params.title,
        body:   params.body  ?? null,
        link:   params.link  ?? null,
      },
    });

    // Queue email if enabled
    const emailGlobal  = pref?.emailEnabled ?? true;
    const emailForType = isTypeEmailEnabled(pref, params.type);

    if (emailGlobal && emailForType) {
      const user = await prisma.user.findUnique({
        where:  { id: params.userId },
        select: { email: true, fullName: true, firstName: true },
      });
      if (user) {
        const name = user.fullName ?? user.firstName;
        try {
          await getEmailQueue().add('send-notification', {
            to:            user.email,
            recipientName: name,
            title:         params.title,
            body:          params.body  ?? null,
            link:          params.link  ?? null,
          });
          await db.notification.update({
            where: { id: notif.id },
            data:  { emailSent: true },
          });
        } catch {
          // Queue unavailable — skip email silently
        }
      }
    }
  } catch (err) {
    console.error('[NOTIFICATION] Failed:', err);
  }
}
