import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/types";

const h = vi.hoisted(() => ({
  grievanceFindById: vi.fn(),
  grievanceUpdateCreate: vi.fn(),
  assignmentFindById: vi.fn(),
  assignmentCreate: vi.fn(),
  assignmentUpdateMany: vi.fn(),
  userFindById: vi.fn(),
  workflowFindById: vi.fn(),
  workflowFind: vi.fn(),
  workflowFindOne: vi.fn(),
  requestUpdateMany: vi.fn(),
  auditLog: vi.fn(),
  logGrievanceEvent: vi.fn(),
  createNotifications: vi.fn(),
}));

vi.mock("@/server/models/grievance.model", () => ({
  Grievance: { findById: h.grievanceFindById },
}));
vi.mock("@/server/models/grievance-update.model", () => ({
  GrievanceUpdate: { create: h.grievanceUpdateCreate },
  UpdateType: {
    PUBLIC_UPDATE: "PUBLIC_UPDATE",
    INTERNAL_NOTE: "INTERNAL_NOTE",
  },
}));
vi.mock("@/server/models/grievance-assignment.model", () => ({
  GrievanceAssignment: {
    findById: h.assignmentFindById,
    create: h.assignmentCreate,
    updateMany: h.assignmentUpdateMany,
  },
}));
vi.mock("@/server/models/user.model", () => ({
  User: { findById: h.userFindById },
}));
// updateStatus supersedes any pending proposal once the complaint moves, so this
// collection is touched on every successful move.
vi.mock("@/server/models/grievance-transition-request.model", () => ({
  TransitionRequest: { updateMany: h.requestUpdateMany },
}));
vi.mock("@/server/models/workflow.model", () => ({
  Workflow: {
    findById: h.workflowFindById,
    findOne: h.workflowFindOne,
    find: () => ({ sort: () => ({ lean: async () => [] }) }),
  },
}));
vi.mock("@/server/services/audit-impl", () => ({
  auditService: { log: h.auditLog },
  logGrievanceEvent: h.logGrievanceEvent,
}));
vi.mock("@/server/services/notification.service", () => ({
  createNotifications: h.createNotifications,
}));
vi.mock("@/server/email", () => ({ sendGrievanceAssignedEmail: vi.fn() }));

import { updateStatus } from "@/server/services/grievances.service";

const GRIEVANCE_ID = "64b7f0000000000000000b01";
const USER_ID = "64b7f0000000000000000b02";
const WORKFLOW_ID = "64b7f0000000000000000b03";
const OTHER_USER_ID = "64b7f0000000000000000b04";

const ADMIN = { userId: USER_ID, role: Role.ADMIN } as never;
const STAFF = { userId: USER_ID, role: Role.STAFF } as never;

/**
 * A workflow with the same shape the seeder produces: forward moves for staff,
 * admin-only reject, and admin-only reopens out of the final stages.
 */
function fakeWorkflow(over: Record<string, unknown> = {}) {
  return {
    _id: WORKFLOW_ID,
    name: "Default",
    startStageKey: "SUBMITTED",
    stages: [
      { key: "SUBMITTED", label: "Submitted", isFinal: false, order: 0 },
      { key: "IN_PROGRESS", label: "In Progress", isFinal: false, order: 1 },
      { key: "RESOLVED", label: "Resolved", isFinal: false, order: 2 },
      { key: "CLOSED", label: "Closed", isFinal: true, order: 3 },
      { key: "REJECTED", label: "Rejected", isFinal: true, order: 4 },
    ],
    transitions: [
      t("SUBMITTED", "IN_PROGRESS", "Start work", ["ADMIN", "STAFF"], false),
      t("IN_PROGRESS", "RESOLVED", "Resolve", ["ADMIN", "STAFF"], false),
      // Reopening is not limited to final stages — the seed draws one out of
      // RESOLVED too, and that is the case the stamp regression was about.
      t("RESOLVED", "IN_PROGRESS", "Reopen", ["ADMIN"], true),
      t("RESOLVED", "CLOSED", "Close", ["ADMIN"]),
      t("RESOLVED", "REJECTED", "Reject", ["ADMIN"]),
      t("CLOSED", "IN_PROGRESS", "Reopen", ["ADMIN"], true),
      t("REJECTED", "IN_PROGRESS", "Reopen", ["ADMIN"], true),
    ],
    ...over,
  };
}

function t(
  from: string,
  to: string,
  actionLabel: string,
  allowedRoles: string[] = ["ADMIN"],
  isReopen = false,
  extra: Record<string, unknown> = {},
) {
  return {
    from,
    to,
    actionLabel,
    allowedRoles,
    requiresApproval: false,
    requiresReason: isReopen,
    requiresAttachment: false,
    isReopen,
    ...extra,
  };
}

function fakeGrievance(over: Record<string, unknown> = {}) {
  return {
    _id: GRIEVANCE_ID,
    referenceCode: "GRV-2026-AABBCCDD",
    status: "RESOLVED",
    workflowId: WORKFLOW_ID,
    categoryId: null,
    primaryAssigneeId: undefined as unknown,
    supportingAssignees: [] as unknown[],
    acknowledgedAt: undefined as Date | undefined,
    resolvedAt: new Date("2026-01-01") as Date | undefined,
    closedAt: undefined as Date | undefined,
    deletedAt: undefined as Date | undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function mockGrievance(over: Record<string, unknown> = {}) {
  const doc = fakeGrievance(over);
  h.grievanceFindById.mockResolvedValue(doc);
  return doc;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.workflowFindById.mockResolvedValue(fakeWorkflow());
  h.workflowFindOne.mockResolvedValue(fakeWorkflow());
  h.grievanceUpdateCreate.mockResolvedValue({});
  h.logGrievanceEvent.mockResolvedValue(undefined);
  h.createNotifications.mockResolvedValue(undefined);
  h.requestUpdateMany.mockResolvedValue({});
});

describe("updateStatus is driven by the workflow, not a hardcoded table", () => {
  it("refuses a move the workflow does not define", async () => {
    const doc = mockGrievance({ status: "IN_PROGRESS" });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "CLOSED" },
        USER_ID,
        "Admin",
        Role.ADMIN,
      ),
    ).rejects.toThrow(/No move from "IN_PROGRESS" to "CLOSED"/);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("refuses a target that is not a stage of the workflow at all", async () => {
    mockGrievance({ status: "IN_PROGRESS" });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "MADE_UP_STAGE" },
        USER_ID,
        "Admin",
        Role.ADMIN,
      ),
    ).rejects.toThrow(/is not a stage of this complaint's workflow/);
  });

  // The reason a stage key can be a custom name at all: the cycle is whatever
  // the admin drew, so a renamed or invented stage must work without a code
  // change.
  it("accepts a stage key that only exists in this workflow", async () => {
    h.workflowFindById.mockResolvedValue(
      fakeWorkflow({
        stages: [
          { key: "REPORTED", label: "Reported", isFinal: false, order: 0 },
          {
            key: "TRIAGE_DONE",
            label: "Triage Done",
            isFinal: false,
            order: 1,
          },
          { key: "DONE", label: "Done", isFinal: true, order: 2 },
        ],
        startStageKey: "REPORTED",
        transitions: [
          t("REPORTED", "TRIAGE_DONE", "Triage"),
          t("TRIAGE_DONE", "DONE", "Finish"),
        ],
      }),
    );
    const doc = mockGrievance({ status: "REPORTED" });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "TRIAGE_DONE" },
      USER_ID,
      "Admin",
      Role.ADMIN,
    );

    expect(doc.status).toBe("TRIAGE_DONE");
  });

  it("refuses a move the role is not allowed to make", async () => {
    // Resolve is open to staff here, but Close is admin-only.
    mockGrievance({ status: "RESOLVED", primaryAssigneeId: USER_ID });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "CLOSED" },
        USER_ID,
        "Staff",
        Role.STAFF,
      ),
    ).rejects.toThrow(/permission/);
  });

  it("will not act at all when no workflow is active", async () => {
    h.workflowFindById.mockResolvedValue(null);
    h.workflowFindOne.mockResolvedValue(null);
    const doc = mockGrievance({ status: "IN_PROGRESS" });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "RESOLVED" },
        USER_ID,
        "Admin",
        Role.ADMIN,
      ),
    ).rejects.toThrow(/No active complaint workflow/);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe("staff are confined to their own complaints", () => {
  it("refuses a move on a complaint assigned to someone else", async () => {
    const doc = mockGrievance({
      status: "IN_PROGRESS",
      primaryAssigneeId: OTHER_USER_ID,
    });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "RESOLVED" },
        USER_ID,
        "Staff",
        Role.STAFF,
      ),
    ).rejects.toThrow(/assigned to you/);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("allows a supporting assignee to move the complaint", async () => {
    const doc = mockGrievance({
      status: "IN_PROGRESS",
      primaryAssigneeId: OTHER_USER_ID,
      supportingAssignees: [USER_ID],
    });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "RESOLVED" },
      USER_ID,
      "Staff",
      Role.STAFF,
    );

    expect(doc.status).toBe("RESOLVED");
  });

  it("lets an admin move a complaint they are not assigned to", async () => {
    const doc = mockGrievance({
      status: "IN_PROGRESS",
      primaryAssigneeId: OTHER_USER_ID,
    });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "RESOLVED" },
      USER_ID,
      "Admin",
      Role.ADMIN,
    );

    expect(doc.status).toBe("RESOLVED");
  });

  // Staff proposing a move is the next phase. Until that path exists, a gated
  // move must be refused rather than applied — otherwise the approval
  // requirement would be silently bypassed.
  it("refuses to apply an approval-gated move directly", async () => {
    h.workflowFindById.mockResolvedValue(
      fakeWorkflow({
        transitions: [
          t("IN_PROGRESS", "RESOLVED", "Resolve", ["ADMIN", "STAFF"], false, {
            requiresApproval: true,
          }),
        ],
      }),
    );
    const doc = mockGrievance({
      status: "IN_PROGRESS",
      primaryAssigneeId: USER_ID,
    });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "RESOLVED" },
        USER_ID,
        "Staff",
        Role.STAFF,
      ),
    ).rejects.toThrow(/needs an admin's approval/);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("still lets an admin apply an approval-gated move directly", async () => {
    h.workflowFindById.mockResolvedValue(
      fakeWorkflow({
        transitions: [
          t("IN_PROGRESS", "RESOLVED", "Resolve", ["ADMIN", "STAFF"], false, {
            requiresApproval: true,
          }),
        ],
      }),
    );
    const doc = mockGrievance({ status: "IN_PROGRESS" });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "RESOLVED", note: "Admin decided" },
      USER_ID,
      "Admin",
      Role.ADMIN,
    );

    expect(doc.status).toBe("RESOLVED");
  });

  it("refuses a reopen by staff even on a reassigned-looking document", async () => {
    const doc = mockGrievance({
      status: "CLOSED",
      primaryAssigneeId: USER_ID,
    });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "IN_PROGRESS", note: "please reopen" },
        USER_ID,
        "Staff",
        Role.STAFF,
      ),
    ).rejects.toThrow(/permission/);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe("reopen is the one way out of a final stage", () => {
  // This was the gap the configurable workflow was meant to close: under the
  // hardcoded table CLOSED was terminal, so a closed complaint could never come
  // back. An admin-drawn reopen edge is now what makes it possible.
  it("lets an admin reopen a closed complaint when a reopen edge exists", async () => {
    const doc = mockGrievance({
      status: "CLOSED",
      closedAt: new Date("2026-01-02"),
      resolvedAt: new Date("2026-01-01"),
    });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "IN_PROGRESS", note: "New evidence received" },
      USER_ID,
      "Admin",
      Role.ADMIN,
    );

    expect(doc.status).toBe("IN_PROGRESS");
  });

  // Leaving a final stage must clear its stamp, or duration metrics go on
  // counting a case that is open again.
  it("clears closedAt and resolvedAt when a closed case is reopened", async () => {
    const doc = mockGrievance({
      status: "CLOSED",
      closedAt: new Date("2026-01-02"),
      resolvedAt: new Date("2026-01-01"),
    });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "IN_PROGRESS", note: "New evidence received" },
      USER_ID,
      "Admin",
      Role.ADMIN,
    );

    expect(doc.closedAt).toBeUndefined();
    expect(doc.resolvedAt).toBeUndefined();
  });

  it("refuses a reopen with no reason, since a revived case must explain itself", async () => {
    const doc = mockGrievance({ status: "CLOSED" });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "IN_PROGRESS" },
        USER_ID,
        "Admin",
        Role.ADMIN,
      ),
    ).rejects.toThrow(/requires a reason/);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("refuses a reopen when the workflow draws no edge out of the final stage", async () => {
    h.workflowFindById.mockResolvedValue(
      fakeWorkflow({
        transitions: [
          t("SUBMITTED", "IN_PROGRESS", "Start work", ["ADMIN", "STAFF"]),
          t("IN_PROGRESS", "RESOLVED", "Resolve", ["ADMIN", "STAFF"]),
          t("RESOLVED", "CLOSED", "Close", ["ADMIN"]),
        ],
      }),
    );
    const doc = mockGrievance({ status: "CLOSED" });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "IN_PROGRESS", note: "Reopen" },
        USER_ID,
        "Admin",
        Role.ADMIN,
      ),
    ).rejects.toThrow(/No move from "CLOSED"/);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe("updateStatus stamps", () => {
  it("stamps resolvedAt on the transition into RESOLVED", async () => {
    const doc = mockGrievance({ status: "IN_PROGRESS" });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "RESOLVED" },
      USER_ID,
      "Admin",
      Role.ADMIN,
    );

    expect(doc.resolvedAt).toBeInstanceOf(Date);
  });

  // `closedAt` follows finality rather than a hardcoded CLOSED key, so a
  // workflow that ends somewhere else still records the end of the complaint.
  it("stamps closedAt on entering any final stage", async () => {
    const doc = mockGrievance({ status: "RESOLVED" });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "CLOSED" },
      USER_ID,
      "Admin",
      Role.ADMIN,
    );

    expect(doc.closedAt).toBeInstanceOf(Date);
    expect(doc.resolvedAt).toBeUndefined();
  });

  it("stamps closedAt on entering a differently named final stage", async () => {
    h.workflowFindById.mockResolvedValue(
      fakeWorkflow({
        stages: [
          { key: "OPEN", label: "Open", isFinal: false, order: 0 },
          { key: "DONE", label: "Done", isFinal: true, order: 1 },
        ],
        startStageKey: "OPEN",
        transitions: [t("OPEN", "DONE", "Finish")],
      }),
    );
    const doc = mockGrievance({ status: "OPEN" });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "DONE" },
      USER_ID,
      "Admin",
      Role.ADMIN,
    );

    expect(doc.closedAt).toBeInstanceOf(Date);
  });

  it("clears resolvedAt when a resolved case moves back to live work", async () => {
    const doc = mockGrievance({ status: "RESOLVED" });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "IN_PROGRESS", note: "Reopened" },
      USER_ID,
      "Admin",
      Role.ADMIN,
    );

    expect(doc.resolvedAt).toBeUndefined();
    expect(doc.save).toHaveBeenCalledOnce();
  });

  it("refuses a deleted complaint", async () => {
    const doc = mockGrievance({ status: "IN_PROGRESS", deletedAt: new Date() });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "RESOLVED" },
        USER_ID,
        "Admin",
        Role.ADMIN,
      ),
    ).rejects.toThrow(/deleted grievance/);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("records the human stage label, not the raw key", async () => {
    mockGrievance({ status: "IN_PROGRESS" });

    await updateStatus(
      GRIEVANCE_ID,
      { status: "RESOLVED" },
      USER_ID,
      "Admin",
      Role.ADMIN,
    );

    expect(h.grievanceUpdateCreate).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Status changed to Resolved" }),
    );
  });

  it("refuses a reason-less move that the workflow says needs one", async () => {
    h.workflowFindById.mockResolvedValue(
      fakeWorkflow({
        transitions: [
          t("IN_PROGRESS", "RESOLVED", "Resolve", ["ADMIN"], false, {
            requiresReason: true,
          }),
        ],
      }),
    );
    const doc = mockGrievance({ status: "IN_PROGRESS" });

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: "RESOLVED" },
        USER_ID,
        "Admin",
        Role.ADMIN,
      ),
    ).rejects.toThrow(/requires a reason/);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

// Keeps the unused-import checker honest about the actor fixtures above.
void ADMIN;
void STAFF;
