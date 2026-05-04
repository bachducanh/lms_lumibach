import type { Prisma } from '@prisma/client';
import { prisma } from './db';

type AuditParams = {
  userId?: string;
  userRole?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
};

export async function auditLog(params: AuditParams): Promise<void> {
  try {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: params.action,
      userId: params.userId,
      userRole: params.userRole,
      resource: params.resource,
      resourceId: params.resourceId,
      changes: params.changes as Prisma.InputJsonValue | undefined,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress,
    };
    await prisma.auditLog.create({ data });
  } catch {
    // Audit log thất bại không nên crash luồng chính
    console.error('[AUDIT] Failed to write audit log:', params.action);
  }
}
