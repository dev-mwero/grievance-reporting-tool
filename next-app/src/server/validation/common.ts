import { z } from "zod";

/**
 * Query parameter controlling whether a list endpoint includes soft-deleted
 * records. Defaults to `active`, so omitting it hides deleted records.
 *
 * - `active`  — live records only (default)
 * - `all`     — live and deleted, e.g. for an audit view
 * - `deleted` — deleted records only, e.g. for a restore tray
 */
export const deletionScopeSchema = z
  .enum(["active", "all", "deleted"])
  .default("active");

export type DeletionScopeQuery = z.infer<typeof deletionScopeSchema>;

/** Optional reason recorded alongside a soft delete. */
export const deleteReasonSchema = z
  .string()
  .trim()
  .max(500, "Reason cannot exceed 500 characters")
  .optional();
