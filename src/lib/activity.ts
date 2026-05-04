import { prisma } from '@/lib/db';
import type { ActivityAction, Prisma } from '@prisma/client';

export type LogActivityParams = {
  userId:        string;
  courseId?:     string;
  action:        ActivityAction;
  resourceType?: string;
  resourceId?:   string;
  resourceName?: string;
  metadata?:     Prisma.InputJsonValue;
  ipAddress?:    string;
};

// Fire-and-forget — never throws, never blocks the caller
export function logActivity(params: LogActivityParams): void {
  prisma.activityLog.create({ data: params }).catch(() => {});
}
