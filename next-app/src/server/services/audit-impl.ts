import { AuditLog } from "../models/audit-log.model";
import {
  ActorType,
  type AuditAction,
  type AuditEvent,
  type AuditService,
} from "./audit.service";

export class MongoAuditService implements AuditService {
  async log(event: Omit<AuditEvent, "timestamp">): Promise<void> {
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
      console.error("[AUDIT] Failed to write audit log:", event);
    }
  }
}

export const auditService = new MongoAuditService();

export async function logGrievanceEvent(
  action: AuditAction,
  grievanceId: string,
  userId?: string,
  userName?: string,
  metadata?: Record<string, unknown>,
) {
  await auditService.log({
    action,
    entityType: "Grievance",
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
  metadata?: Record<string, unknown>,
) {
  await auditService.log({
    action,
    entityType: "User",
    entityId: userId,
    actorId: actorId || userId,
    actorType: ActorType.USER,
    actorName: actorName || "System",
    metadata,
  });
}

export async function logCategoryEvent(
  action: AuditAction,
  categoryId: string,
  userId?: string,
  userName?: string,
  metadata?: Record<string, unknown>,
) {
  await auditService.log({
    action,
    entityType: "GrievanceCategory",
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
  metadata?: Record<string, unknown>,
) {
  await auditService.log({
    action,
    entityType: "SubCounty",
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
  metadata?: Record<string, unknown>,
) {
  await auditService.log({
    action,
    entityType: "Ward",
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
  metadata?: Record<string, unknown>,
) {
  await auditService.log({
    action,
    entityType: "Auth",
    entityId: email,
    actorId: userId,
    actorType: userId ? ActorType.USER : ActorType.ANONYMOUS,
    metadata,
  });
}
