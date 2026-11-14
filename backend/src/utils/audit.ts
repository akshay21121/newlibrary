import { Request } from 'express';
import { prisma } from '../config/prisma.js';

export async function logAuditEvent(
  entityType: string,
  action: string,
  entityId?: string | null,
  details?: any,
  req?: Request
): Promise<void> {
  try {
    const ipAddress = req?.ip || req?.socket?.remoteAddress || null;
    const userAgent = req?.get('user-agent') || null;

    await prisma.auditLog.create({
      data: {
        entityType,
        action,
        entityId: entityId || null,
        details: details ? JSON.stringify(details) : null,
        ipAddress: typeof ipAddress === 'string' ? ipAddress : null,
        userAgent,
      },
    });
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}

