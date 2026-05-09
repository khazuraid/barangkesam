import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { emitToUser, getIO } from '../../sockets/index.js';

const DEDUP_WINDOW_MS = 30_000;

export interface VerificationLogOptions {
  entityType: string;
  entityId: string;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  note?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

/**
 * Catat transisi status verifikasi ke tabel `verification_logs`.
 * Fire-and-forget — error tidak mengganggu request utama.
 */
export async function logVerification(opts: VerificationLogOptions): Promise<void> {
  try {
    await prisma.verificationLog.create({
      data: {
        entity_type: opts.entityType.slice(0, 30),
        entity_id: opts.entityId.slice(0, 100),
        from_status: opts.fromStatus.slice(0, 20),
        to_status: opts.toStatus.slice(0, 20),
        actor_id: opts.actorId,
        note: opts.note ?? null,
        metadata: (opts.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  } catch (err) {
    console.error('[verificationLogger] failed to log:', err);
  }
}

export interface NotifyUserOptions {
  userId: string;
  title: string;
  message?: string;
  type?: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  link?: string | null;
}

/**
 * Buat notifikasi in-app + emit socket ke user tertentu.
 */
export async function notifyUser(opts: NotifyUserOptions): Promise<void> {
  try {
    const now = new Date();
    const dedupSince = new Date(now.getTime() - DEDUP_WINDOW_MS);

    const normalizedType = opts.type ?? 'INFO';
    const normalizedTitle = opts.title.slice(0, 200);
    const normalizedMessage = (opts.message ?? '').slice(0, 500);
    const normalizedLink = opts.link ?? null;

    const recentDuplicate = await prisma.notification.findFirst({
      where: {
        user_id: opts.userId,
        type: normalizedType,
        title: normalizedTitle,
        link: normalizedLink,
        created_at: { gte: dedupSince },
      },
      select: { id: true },
      orderBy: { created_at: 'desc' },
    });

    if (recentDuplicate) {
      return;
    }

    const notif = await prisma.notification.create({
      data: {
        user_id: opts.userId,
        title: normalizedTitle,
        message: normalizedMessage,
        type: normalizedType,
        link: normalizedLink,
      },
    });

    emitToUser(opts.userId, 'notification.new', {
      id: notif.id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      link: notif.link,
      is_read: notif.is_read,
      created_at: notif.created_at,
    });
    emitToUser(opts.userId, 'notification.unread_count_changed', { delta: 1 });
  } catch (err) {
    console.error('[notifyUser] failed:', err);
  }
}

/**
 * Notify semua ADMIN yang aktif (tanpa  filter).
 */
export async function notifyAdmins(payload: Omit<NotifyUserOptions, 'userId'>): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', is_active: true },
      select: { id: true },
    });
    await Promise.all(admins.map((a) => notifyUser({ ...payload, userId: a.id })));
  } catch (err) {
    console.error('[notifyAdmins] failed:', err);
  }
}

/**
 * Broadcast event workflow ke semua client (optional, untuk counter live).
 */
export function broadcastVerificationEvent(event: string, payload: unknown): void {
  try {
    getIO().emit(event, payload);
  } catch {
    // ignore jika socket belum init (mis. saat test)
  }
}
