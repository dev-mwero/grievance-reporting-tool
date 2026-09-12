import { AuditLog } from '../models/audit-log.model';
import type { AuditService, AuditEvent } from './audit.service';
import { AuditAction, ActorType } from './audit.service';

/**
 * MongoDB-backed audit service.
 * Captures all mutations with actor context and metadata.
 * Logs are automatically purged after 2 years via TTL index.
 */
export class MongoAuditService implements AuditService {
  async log(event: Omit<AuditEvent, 'timestamp'>): Promise<void> {
    try {
      await AuditLog.create({
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        actorId: event.actorId || undefined,
        actorType: event.actorType,
        actorName: event.actorName || undefined,
        metadata: event.metadata || undefined,
        timestamp: new Date(),
      });
    } catch {
      // Audit logging should never crash the request
      console.error('[AUDIT] Failed to write audit log:', event);
    }
  }

  async query(filters: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ events: AuditEvent[]; total: number }> {
    const { entityType, entityId, actorId, action, startDate, endDate, page = 1, limit = 20 } = filters;

    const filter: Record<string, unknown> = {};

    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (actorId) filter.actorId = actorId;
    if (action) filter.action = action;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) (filter.timestamp as Record<string, unknown>).$gte = startDate;
      if (endDate) (filter.timestamp as Record<string, unknown>).$lte = endDate;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return { events: logs as AuditEvent[], total };
  }
}

// Singleton
export const auditService = new MongoAuditService();

// ─── Helper: log common grievance events ────────────────────────────────────

export async function logGrievanceEvent(
  action: AuditAction,
  grievanceId: string,
  userId?: string,
  userName?: string,
  metadata?: Record<string, unknown>
) {
  await auditService.log({
    action,
    entityType: 'Grievance',
    entityId: grievanceId,
    actorId: userId,
    actorType: userId ? ActorType.USER : ActorType.SYSTEM,
    actorName: userName,
    metadata,
  });
}

export async function logUserEvent(
  action: AuditAction,
  userId: string,
  actorId?: string,
  actorName?: string,
  metadata?: Record<string, unknown>
) {
  await auditService.log({
    action,
    entityType: 'User',
    entityId: userId,
    actorId: actorId || userId,
    actorType: ActorType.USER,
    actorName: actorName || 'System',
    metadata,
  });
}

export async function logCategoryEvent(
  action: AuditAction,
  categoryId: string,
  userId?: string,
  userName?: string,
  metadata?: Record<string, unknown>
) {
  await auditService.log({
    action,
    entityType: 'GrievanceCategory',
    entityId: categoryId,
    actorId: userId,
    actorType: userId ? ActorType.USER : ActorType.SYSTEM,
    actorName: userName,
    metadata,
  });
}

export async function logSubCountyEvent(
  action: AuditAction,
  subCountyId: string,
  userId?: string,
  userName?: string,
  metadata?: Record<string, unknown>
) {
  await auditService.log({
    action,
    entityType: 'SubCounty',
    entityId: subCountyId,
    actorId: userId,
    actorType: userId ? ActorType.USER : ActorType.SYSTEM,
    actorName: userName,
    metadata,
  });
}

export async function logWardEvent(
  action: AuditAction,
  wardId: string,
  userId?: string,
  userName?: string,
  metadata?: Record<string, unknown>
) {
  await auditService.log({
    action,
    entityType: 'Ward',
    entityId: wardId,
    actorId: userId,
    actorType: userId ? ActorType.USER : ActorType.SYSTEM,
    actorName: userName,
    metadata,
  });
}

export async function logAuthEvent(
  action: AuditAction,
  email: string,
  userId?: string,
  metadata?: Record<string, unknown>
) {
  await auditService.log({
    action,
    entityType: 'Auth',
    entityId: email,
    actorId: userId,
    actorType: userId ? ActorType.USER : ActorType.ANONYMOUS,
    metadata,
  });
}