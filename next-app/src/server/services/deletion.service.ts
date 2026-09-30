import { type Document, type Model, Types } from "mongoose";
import { ApiError } from "../api-error";
import type { ISoftDeletable } from "../models/soft-delete";
import { ActorType, type AuditAction } from "./audit.service";
import { auditService } from "./audit-impl";

/** The administrator performing the deletion. */
export interface DeletionActor {
  id: string;
  name?: string;
}

/** Identifies the collection being operated on. */
export interface DeletionTarget<T> {
  /** Human-readable label used in error messages, e.g. `"Category"`. */
  label: string;
  /** Audit-log entity type, e.g. `"GrievanceCategory"`. */
  entityType: string;
  model: Model<T>;
}

/** The three audit actions an entity registers for its lifecycle. */
export interface DeletionActions {
  softDelete: AuditAction;
  restore: AuditAction;
  purge: AuditAction;
}

/**
 * Entity-specific behaviour layered onto the generic operations. Hooks keep
 * the shared mechanics identical across every collection while each entity
 * retains its own guards and cascade rules.
 */
export interface DeletionHooks<T> {
  /** Mutate the document immediately before a soft delete is saved. */
  beforeSoftDelete?: (doc: T) => Promise<void> | void;
  /** Mutate the document immediately before a restore is saved. */
  beforeRestore?: (doc: T) => Promise<void> | void;
  /** Guard a purge. Throw an `ApiError` to abort (e.g. referential integrity). */
  beforePurge?: (doc: T) => Promise<void> | void;
  /** Remove records that cannot exist without their parent. */
  cascadePurge?: (doc: T) => Promise<void>;
  /** Extra audit metadata, e.g. the name of the record being removed. */
  metadata?: (doc: T) => Record<string, unknown> | undefined;
}

/** A loaded record, narrowed to what the shared operations need. */
type Deletable<T> = T & Document & ISoftDeletable;

async function load<T extends Document & ISoftDeletable>(
  target: DeletionTarget<T>,
  id: string,
): Promise<Deletable<T>> {
  const doc: Deletable<T> | null = await target.model.findById(id);
  if (!doc) {
    throw ApiError.notFound(`${target.label} not found`);
  }
  return doc;
}

/**
 * Apply the soft-delete marker. Takes the narrow interface rather than the
 * document so the assignment needs no cast at the call site.
 */
function markDeleted(doc: ISoftDeletable, actorId: string, reason?: string) {
  doc.deletedAt = new Date();
  doc.deletedBy = new Types.ObjectId(actorId);
  doc.deleteReason = reason;
}

/**
 * Clear the soft-delete marker. Fields are unset rather than nulled so a
 * restored record is indistinguishable from one that was never deleted.
 */
function markRestored(doc: ISoftDeletable) {
  doc.deletedAt = undefined;
  doc.deletedBy = undefined;
  doc.deleteReason = undefined;
}

async function writeAudit<T>(
  target: DeletionTarget<T>,
  action: AuditAction,
  entityId: string,
  actor: DeletionActor,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await auditService.log({
    action,
    entityType: target.entityType,
    entityId,
    actorId: actor.id,
    actorType: ActorType.USER,
    actorName: actor.name,
    metadata,
  });
}

// ─── Soft Delete ────────────────────────────────────────────────────────────

/**
 * Mark a record deleted without removing it. The record drops out of every
 * normal read path but stays recoverable, and this is the only deletion tier
 * an ordinary admin has access to.
 */
export async function softDeleteRecord<T extends Document & ISoftDeletable>(
  target: DeletionTarget<T>,
  actions: DeletionActions,
  id: string,
  actor: DeletionActor,
  hooks: DeletionHooks<T> = {},
  reason?: string,
): Promise<Deletable<T>> {
  const doc = await load(target, id);

  if (doc.deletedAt) {
    throw ApiError.conflict(`${target.label} is already deleted`);
  }

  await hooks.beforeSoftDelete?.(doc);
  markDeleted(doc, actor.id, reason);
  await doc.save();

  await writeAudit(target, actions.softDelete, id, actor, {
    reason,
    ...hooks.metadata?.(doc),
  });

  return doc;
}

// ─── Restore ────────────────────────────────────────────────────────────────

/** Undo a soft delete, returning the record to normal visibility. */
export async function restoreRecord<T extends Document & ISoftDeletable>(
  target: DeletionTarget<T>,
  actions: DeletionActions,
  id: string,
  actor: DeletionActor,
  hooks: DeletionHooks<T> = {},
): Promise<Deletable<T>> {
  const doc = await load(target, id);

  if (!doc.deletedAt) {
    throw ApiError.badRequest(`${target.label} is not deleted`);
  }

  await hooks.beforeRestore?.(doc);
  markRestored(doc);
  await doc.save();

  await writeAudit(target, actions.restore, id, actor, hooks.metadata?.(doc));

  return doc;
}

// ─── Purge ──────────────────────────────────────────────────────────────────

/**
 * Permanently remove a record and anything that cannot outlive it. Only
 * reachable by system admins, and only ever audited — never recoverable.
 */
export async function purgeRecord<T extends Document & ISoftDeletable>(
  target: DeletionTarget<T>,
  actions: DeletionActions,
  id: string,
  actor: DeletionActor,
  hooks: DeletionHooks<T> = {},
): Promise<Deletable<T>> {
  const doc = await load(target, id);

  await hooks.beforePurge?.(doc);
  await hooks.cascadePurge?.(doc);
  await doc.deleteOne();

  await writeAudit(target, actions.purge, id, actor, hooks.metadata?.(doc));

  return doc;
}
