import type { LogAction } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../config/database.js';

export interface LogActivityOptions {
  userId: string;
  action: LogAction;
  entity: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, unknown> | null;
  req?: Request;
}

/**
 * Log activity ke tabel activity_logs. Fire-and-forget - error tidak akan
 * mengganggu jalannya request utama.
 */
export async function logActivity(opts: LogActivityOptions): Promise<void> {
  try {
    const ip =
      opts.req?.ip ||
      (opts.req?.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      null;
    const ua = opts.req?.headers['user-agent']?.slice(0, 300) || null;

    await prisma.activityLog.create({
      data: {
        user_id: opts.userId,
        action: opts.action,
        entity: opts.entity.slice(0, 50),
        entity_id: opts.entityId?.slice(0, 100) || null,
        description: opts.description.slice(0, 500),
        metadata: (opts.metadata as object | null) ?? undefined,
        ip_address: ip,
        user_agent: ua,
      },
    });
  } catch (err) {
    console.error('[activityLogger] failed to log:', err);
  }
}
