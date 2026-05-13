import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@lumibach/db';

type AuditParams = {
  userId?: string;
  userRole?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  log(params: AuditParams): void {
    this.prisma.auditLog
      .create({
        data: {
          action: params.action,
          userId: params.userId,
          userRole: params.userRole,
          resource: params.resource,
          resourceId: params.resourceId,
          changes: params.changes as any,
          metadata: params.metadata as any,
        },
      })
      .catch(() => {});
  }
}
