import { GrievanceStatus, STATUS_TRANSITIONS } from "@/types";
import { Workflow } from "./models/workflow.model";

/**
 * Human labels for the seeded stages. These are display names only — the `key`
 * stays the raw status value so every complaint already in the database is
 * still sitting on a stage that exists.
 */
const SEED_LABELS: Record<string, { label: string; color?: string }> = {
  [GrievanceStatus.SUBMITTED]: { label: "Submitted", color: "slate" },
  [GrievanceStatus.ACKNOWLEDGED]: { label: "Acknowledged", color: "sky" },
  [GrievanceStatus.UNDER_REVIEW]: { label: "Under review", color: "indigo" },
  [GrievanceStatus.ASSIGNED]: { label: "Assigned", color: "violet" },
  [GrievanceStatus.IN_PROGRESS]: { label: "In progress", color: "amber" },
  [GrievanceStatus.RESOLVED]: { label: "Resolved", color: "emerald" },
  [GrievanceStatus.CLOSED]: { label: "Closed", color: "green" },
  [GrievanceStatus.REJECTED]: { label: "Rejected", color: "rose" },
};

/** Action verbs for the seeded moves, so the builder shows something readable. */
const SEED_ACTION_LABELS: Record<string, string> = {
  [`${GrievanceStatus.SUBMITTED}>${GrievanceStatus.ACKNOWLEDGED}`]:
    "Acknowledge",
  [`${GrievanceStatus.SUBMITTED}>${GrievanceStatus.REJECTED}`]: "Reject",
  [`${GrievanceStatus.ACKNOWLEDGED}>${GrievanceStatus.UNDER_REVIEW}`]:
    "Begin review",
  [`${GrievanceStatus.ACKNOWLEDGED}>${GrievanceStatus.REJECTED}`]: "Reject",
  [`${GrievanceStatus.UNDER_REVIEW}>${GrievanceStatus.ASSIGNED}`]: "Assign",
  [`${GrievanceStatus.UNDER_REVIEW}>${GrievanceStatus.RESOLVED}`]: "Resolve",
  [`${GrievanceStatus.UNDER_REVIEW}>${GrievanceStatus.REJECTED}`]: "Reject",
  [`${GrievanceStatus.ASSIGNED}>${GrievanceStatus.IN_PROGRESS}`]: "Start work",
  [`${GrievanceStatus.ASSIGNED}>${GrievanceStatus.REJECTED}`]: "Reject",
  [`${GrievanceStatus.IN_PROGRESS}>${GrievanceStatus.RESOLVED}`]: "Resolve",
  [`${GrievanceStatus.IN_PROGRESS}>${GrievanceStatus.REJECTED}`]: "Reject",
  [`${GrievanceStatus.RESOLVED}>${GrievanceStatus.CLOSED}`]: "Close",
  [`${GrievanceStatus.RESOLVED}>${GrievanceStatus.IN_PROGRESS}`]: "Reopen",
};

/**
 * Whether a seeded move needs an admin to sign it off.
 *
 * Rejection is admin-only: it ends the complaint, and a staff member deciding
 * that unilaterally is exactly what the approval requirement exists to prevent.
 * Reopening is the same — it re-opens work someone closed.
 */
function seedRequiresApproval(from: string, to: string): boolean {
  return (
    to === GrievanceStatus.REJECTED ||
    (from === GrievanceStatus.RESOLVED && to === GrievanceStatus.IN_PROGRESS)
  );
}

/** Rejecting is a decision that must be justified in the record. */
function seedRequiresReason(from: string, to: string): boolean {
  return (
    to === GrievanceStatus.REJECTED ||
    (from === GrievanceStatus.RESOLVED && to === GrievanceStatus.IN_PROGRESS)
  );
}

export const GLOBAL_WORKFLOW_NAME = "Default complaint cycle";

const globalWithWorkflowSeed: {
  workflowSeedAttempted?: boolean;
} = globalThis as {
  workflowSeedAttempted?: boolean;
};

/**
 * Seed the global workflow from the hardcoded status enum, so the switch to
 * configurable workflows changes nothing about how a complaint behaves on day
 * one — the seeded graph is exactly `STATUS_TRANSITIONS`.
 *
 * Idempotent: does nothing once any workflow exists, so an admin's edits are
 * never overwritten by a later cold start. Guards on "any workflow" rather than
 * "the global one" so a deployment that deliberately starts with only a
 * category-specific workflow is not clobbered either.
 */
export async function bootstrapDefaultWorkflow(): Promise<void> {
  if (globalWithWorkflowSeed.workflowSeedAttempted) return;
  globalWithWorkflowSeed.workflowSeedAttempted = true;

  try {
    const anyWorkflow = await Workflow.findOne({}).select("_id").lean();
    if (anyWorkflow) return;

    const stages = Object.values(GrievanceStatus).map((key, index) => ({
      key,
      label: SEED_LABELS[key]?.label ?? key,
      color: SEED_LABELS[key]?.color,
      isFinal:
        key === GrievanceStatus.CLOSED || key === GrievanceStatus.REJECTED,
      order: index,
    }));

    const transitions = Object.entries(STATUS_TRANSITIONS).flatMap(
      ([from, targets]) =>
        targets.map((to) => ({
          from,
          to,
          actionLabel:
            SEED_ACTION_LABELS[`${from}>${to}`] ?? `${to.replace(/_/g, " ")}`,
          // Admin-only moves (reject, reopen) list no staff role; the
          // availableTransitions() admin bypass keeps them reachable regardless.
          allowedRoles: seedRequiresApproval(from, to) ? ["ADMIN"] : ["STAFF"],
          requiresApproval: seedRequiresApproval(from, to),
          requiresReason: seedRequiresReason(from, to),
          requiresAttachment: false,
        })),
    );

    await Workflow.create({
      name: GLOBAL_WORKFLOW_NAME,
      description:
        "The default complaint cycle. Every complaint uses this unless its category defines its own.",
      isGlobal: true,
      stages,
      transitions,
      startStageKey: GrievanceStatus.SUBMITTED,
      isActive: true,
    });

    console.warn(
      "[BOOTSTRAP] Seeded the default complaint workflow from the built-in status cycle.",
    );
  } catch (error) {
    // A parallel cold start may have won the race; the workflow exists either way.
    const code = (error as { code?: number })?.code;
    if (code === 11000) return;
    console.error("[BOOTSTRAP] Failed to seed the default workflow:", error);
  }
}
