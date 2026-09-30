import mongoose, { type IndexDefinition, Schema } from "mongoose";

/**
 * Soft delete is modelled as a `deletedAt` marker rather than reusing the
 * `isActive` flag, because the two mean different things:
 *
 * - `isActive` — the record still exists and may still be referenced, it is
 *   just not offered for new work (a hidden category, a suspended account).
 * - `deletedAt` — the record has been removed from the system. Every normal
 *   read path filters it out, and only an admin explicitly asking for deleted
 *   records sees it.
 *
 * Keeping them separate means a record can be hidden without being restorable
 * as a side effect, and a deleted record retains a full audit trail of who
 * removed it, when, and why.
 */
export interface ISoftDeletable {
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  deleteReason?: string;
}

/** Schema fragment spread into every soft-deletable model's definition. */
export const softDeleteFields = {
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  deleteReason: {
    type: String,
    trim: true,
    // Annotated so the `[length, message]` tuple survives being spread into a
    // schema definition, where it would otherwise widen to `(string | number)[]`.
    maxlength: [500, "Reason cannot exceed 500 characters"] as [number, string],
  },
};

/** Index fragment supporting the `deletedAt` predicate on every list query. */
export const softDeleteIndex: IndexDefinition = { deletedAt: 1 };

/** Which slice of a soft-deletable collection a read should return. */
export type DeletionScope = "active" | "all" | "deleted";

/** Matches only records that have not been soft deleted. */
export function notDeleted(): Record<string, unknown> {
  return { deletedAt: { $exists: false } };
}

/** Matches only records that have been soft deleted. */
export function onlyDeleted(): Record<string, unknown> {
  return { deletedAt: { $exists: true } };
}

/**
 * Translate a request's deletion scope into a Mongo predicate. Defaults to
 * `active`, so a caller that forgets the parameter still gets the safe
 * behaviour of hiding deleted records.
 */
export function deletionFilter(scope?: DeletionScope): Record<string, unknown> {
  if (scope === "all") return {};
  if (scope === "deleted") return onlyDeleted();
  return notDeleted();
}
