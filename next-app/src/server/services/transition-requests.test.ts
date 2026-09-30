import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/types";

const h = vi.hoisted(() => ({
  grievanceFindById: vi.fn(),
  workflowFindById: vi.fn(),
  workflowFindOne: vi.fn(),
  requestCreate: vi.fn(),
  requestFindById: vi.fn(),
  requestFindOne: vi.fn(),
  requestFind: vi.fn(),
  requestUpdateMany: vi.fn(),
  userFind: vi.fn(),
  updateStatus: vi.fn(),
  attachmentCountDocuments: vi.fn(),
  attachToGrievance: vi.fn(),
  logGrievanceEvent: vi.fn(),
  createNotifications: vi.fn(),
}));

vi.mock("@/server/models/grievance.model", () => ({
  Grievance: { findById: h.grievanceFindById },
}));
vi.mock("@/server/models/grievance-transition-request.model", () => ({
  TransitionRequest: {
    create: h.requestCreate,
    findById: h.requestFindById,
    findOne: h.requestFindOne,
    find: h.requestFind,
    updateMany: h.requestUpdateMany,
  },
}));
vi.mock("@/server/models/user.model", () => ({ User: { find: h.userFind } }));
vi.mock("@/server/models/workflow.model", () => ({
  Workflow: {
    findById: h.workflowFindById,
    findOne: h.workflowFindOne,
    find: () => ({ sort: () => ({ lean: async () => [] }) }),
  },
}));
vi.mock("@/server/services/grievances.service", () => ({
  updateStatus: h.updateStatus,
}));
// A proposal may arrive with freshly uploaded evidence, which the service claims
// before queueing the request.
vi.mock("@/server/services/attachments.service", () => ({
  attachToGrievance: h.attachToGrievance,
}));
vi.mock("@/server/models/attachment.model", () => ({
  Attachment: { countDocuments: h.attachmentCountDocuments },
}));
vi.mock("@/server/services/audit-impl", () => ({
  auditService: { log: vi.fn() },
  logGrievanceEvent: h.logGrievanceEvent,
}));
vi.mock("@/server/services/notification.service", () => ({
  createNotifications: h.createNotifications,
}));

import {
  approveTransition,
  proposeTransition,
  rejectTransition,
  supersedeForGrievance,
  withdrawTransition,
} from "@/server/services/transition-requests.service";

const GRIEVANCE_ID = "64b7f0000000000000000b01";
const STAFF_ID = "64b7f0000000000000000b02";
const ADMIN_ID = "64b7f0000000000000000b03";
const WORKFLOW_ID = "64b7f0000000000000000b04";

const STAFF = { userId: STAFF_ID, name: "Staff One", role: Role.STAFF };
const ADMIN = { userId: ADMIN_ID, name: "Admin One", role: Role.ADMIN };

/** A workflow whose only gated move is IN_PROGRESS → RESOLVED. */
function workflow(over: Record<string, unknown> = {}) {
  return {
    _id: WORKFLOW_ID,
    startStageKey: "SUBMITTED",
    stages: [
      { key: "SUBMITTED", label: "Submitted", isFinal: false, order: 0 },
      { key: "IN_PROGRESS", label: "In Progress", isFinal: false, order: 1 },
      { key: "RESOLVED", label: "Resolved", isFinal: true, order: 2 },
    ],
    transitions: [
      {
        from: "SUBMITTED",
        to: "IN_PROGRESS",
        actionLabel: "Start work",
        allowedRoles: ["ADMIN", "STAFF"],
        requiresApproval: false,
        requiresReason: false,
        requiresAttachment: false,
      },
      {
        from: "IN_PROGRESS",
        to: "RESOLVED",
        actionLabel: "Resolve",
        allowedRoles: ["ADMIN", "STAFF"],
        requiresApproval: true,
        requiresReason: true,
        requiresAttachment: false,
      },
    ],
    ...over,
  };
}

function grievance(over: Record<string, unknown> = {}) {
  return {
    _id: GRIEVANCE_ID,
    referenceCode: "GRV-2026-AABBCCDD",
    status: "IN_PROGRESS",
    workflowId: WORKFLOW_ID,
    categoryId: null,
    primaryAssigneeId: STAFF_ID,
    supportingAssignees: [],
    deletedAt: undefined as Date | undefined,
    ...over,
  };
}

/** A stored request, with `save` recording the writes made to it. */
function request(over: Record<string, unknown> = {}) {
  return {
    _id: "64b7f0000000000000000b10",
    grievanceId: GRIEVANCE_ID,
    referenceCode: "GRV-2026-AABBCCDD",
    actionLabel: "Resolve",
    fromStage: "IN_PROGRESS",
    toStage: "RESOLVED",
    reason: "Fixed and verified with the complainant",
    status: "PENDING",
    proposedBy: { toString: () => STAFF_ID },
    proposedByName: "Staff One",
    reviewedByName: undefined as string | undefined,
    decisionNote: undefined as string | undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.workflowFindById.mockResolvedValue(workflow());
  h.requestFindOne.mockResolvedValue(null);
  h.requestCreate.mockImplementation(async (doc: unknown) => doc);
  h.userFind.mockReturnValue({
    select: () => [{ _id: { toString: () => ADMIN_ID } }],
  });
  h.logGrievanceEvent.mockResolvedValue(undefined);
  h.createNotifications.mockResolvedValue(undefined);
  h.updateStatus.mockResolvedValue({});
  h.attachmentCountDocuments.mockResolvedValue(0);
  h.attachToGrievance.mockResolvedValue([]);
});

describe("proposing a move", () => {
  it("records the request without moving the complaint", async () => {
    h.grievanceFindById.mockResolvedValue(grievance());

    const created = (await proposeTransition(
      GRIEVANCE_ID,
      { to: "RESOLVED", reason: "Fixed and verified" },
      STAFF_ID,
      "Staff One",
      Role.STAFF,
    )) as unknown as Record<string, unknown>;

    // The whole point: proposing must not change the stage.
    expect(h.updateStatus).not.toHaveBeenCalled();
    expect(created.status).toBe("PENDING");
    expect(created.fromStage).toBe("IN_PROGRESS");
    expect(created.toStage).toBe("RESOLVED");
    // Snapshotted so the queue shows what was asked even if the builder changes.
    expect(created.actionLabel).toBe("Resolve");
  });

  it("refuses a proposal with no reason", async () => {
    h.grievanceFindById.mockResolvedValue(grievance());

    await expect(
      proposeTransition(
        GRIEVANCE_ID,
        { to: "RESOLVED", reason: "   " },
        STAFF_ID,
        "Staff One",
        Role.STAFF,
      ),
    ).rejects.toThrow(/reason is required/);
    expect(h.requestCreate).not.toHaveBeenCalled();
  });

  it("refuses a move that does not need approval, pointing at the direct route", async () => {
    // Sending an ungated move through an approval queue would make staff wait
    // for something they were always allowed to do.
    h.grievanceFindById.mockResolvedValue(grievance({ status: "SUBMITTED" }));

    await expect(
      proposeTransition(
        GRIEVANCE_ID,
        { to: "IN_PROGRESS", reason: "Starting" },
        STAFF_ID,
        "Staff One",
        Role.STAFF,
      ),
    ).rejects.toThrow(/does not need approval/);
  });

  it("refuses a proposal from someone not assigned to the complaint", async () => {
    h.grievanceFindById.mockResolvedValue(
      grievance({ primaryAssigneeId: "64b7f0000000000000000b99" }),
    );

    await expect(
      proposeTransition(
        GRIEVANCE_ID,
        { to: "RESOLVED", reason: "Done" },
        STAFF_ID,
        "Staff One",
        Role.STAFF,
      ),
    ).rejects.toThrow(/assigned to you/);
  });

  it("refuses a second proposal while one is already pending", async () => {
    h.grievanceFindById.mockResolvedValue(grievance());
    h.requestFindOne.mockResolvedValue({ _id: "existing" });

    await expect(
      proposeTransition(
        GRIEVANCE_ID,
        { to: "RESOLVED", reason: "Done" },
        STAFF_ID,
        "Staff One",
        Role.STAFF,
      ),
    ).rejects.toThrow(/already awaiting approval/);
  });

  it("refuses a move the workflow does not define", async () => {
    h.grievanceFindById.mockResolvedValue(grievance());

    await expect(
      proposeTransition(
        GRIEVANCE_ID,
        { to: "SUBMITTED", reason: "Back" },
        STAFF_ID,
        "Staff One",
        Role.STAFF,
      ),
    ).rejects.toThrow(/No move from/);
  });

  // An admin has no reason to take the slower route past their own authority.
  it("refuses to let an admin propose at all", async () => {
    await expect(
      proposeTransition(
        GRIEVANCE_ID,
        { to: "RESOLVED", reason: "Done" },
        ADMIN_ID,
        "Admin One",
        Role.ADMIN,
      ),
    ).rejects.toThrow(/no approval needed/);
  });

  it("notifies admins that a decision is waiting", async () => {
    h.grievanceFindById.mockResolvedValue(grievance());

    await proposeTransition(
      GRIEVANCE_ID,
      { to: "RESOLVED", reason: "Fixed" },
      STAFF_ID,
      "Staff One",
      Role.STAFF,
    );

    expect(h.createNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: ADMIN_ID,
        referenceCode: "GRV-2026-AABBCCDD",
      }),
    ]);
  });
});

describe("approving a move", () => {
  it("applies the move and records who approved it", async () => {
    const doc = request();
    h.requestFindById.mockResolvedValue(doc);
    h.grievanceFindById.mockResolvedValue(grievance());

    await approveTransition(doc._id, ADMIN);

    expect(h.updateStatus).toHaveBeenCalledWith(
      GRIEVANCE_ID,
      { status: "RESOLVED", note: "Fixed and verified with the complainant" },
      ADMIN_ID,
      expect.stringContaining("Staff One"),
      Role.ADMIN,
      { exceptRequestId: doc._id },
    );
    expect(doc.status).toBe("APPROVED");
    expect(doc.reviewedByName).toBe("Admin One");
  });

  // The dangerous case: the complaint moved after the proposal was written, so
  // approving would jump it from wherever it is now using a decision made for a
  // different situation.
  it("refuses to approve once the complaint has moved on", async () => {
    const doc = request();
    h.requestFindById.mockResolvedValue(doc);
    h.grievanceFindById.mockResolvedValue(grievance({ status: "SUBMITTED" }));

    await expect(approveTransition(doc._id, ADMIN)).rejects.toThrow(
      /already moved to another stage/,
    );
    expect(h.updateStatus).not.toHaveBeenCalled();
    // Closed out rather than left pending forever in the queue.
    expect(doc.status).toBe("SUPERSEDED");
  });

  it("refuses to approve a deleted complaint", async () => {
    const doc = request();
    h.requestFindById.mockResolvedValue(doc);
    h.grievanceFindById.mockResolvedValue(grievance({ deletedAt: new Date() }));

    await expect(approveTransition(doc._id, ADMIN)).rejects.toThrow(
      /no longer available/,
    );
    expect(h.updateStatus).not.toHaveBeenCalled();
    expect(doc.status).toBe("SUPERSEDED");
  });

  it("refuses to decide a request twice", async () => {
    h.requestFindById.mockResolvedValue(request({ status: "APPROVED" }));

    await expect(approveTransition("any", ADMIN)).rejects.toThrow(
      /already approved/,
    );
  });

  it("refuses approval by anyone but an admin", async () => {
    await expect(approveTransition("any", { ...STAFF })).rejects.toThrow(
      /Only an admin/,
    );
  });

  it("tells the proposer their request was approved", async () => {
    const doc = request();
    h.requestFindById.mockResolvedValue(doc);
    h.grievanceFindById.mockResolvedValue(grievance());

    await approveTransition(doc._id, ADMIN);

    expect(h.createNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ recipientId: STAFF_ID }),
    ]);
  });
});

describe("declining a move", () => {
  it("leaves the complaint untouched and records the note", async () => {
    const doc = request();
    h.requestFindById.mockResolvedValue(doc);

    await rejectTransition(
      doc._id,
      { note: "Need the site report first" },
      ADMIN,
    );

    expect(h.updateStatus).not.toHaveBeenCalled();
    expect(doc.status).toBe("REJECTED");
    expect(doc.decisionNote).toBe("Need the site report first");
  });

  it("declines without a note when none is given", async () => {
    const doc = request();
    h.requestFindById.mockResolvedValue(doc);

    await rejectTransition(doc._id, {}, ADMIN);

    expect(doc.status).toBe("REJECTED");
    expect(doc.decisionNote).toBeUndefined();
  });

  it("refuses a decline by anyone but an admin", async () => {
    await expect(rejectTransition("any", {}, { ...STAFF })).rejects.toThrow(
      /Only an admin/,
    );
  });
});

describe("withdrawing a request", () => {
  it("lets the proposer withdraw their own", async () => {
    const doc = request();
    h.requestFindById.mockResolvedValue(doc);

    await withdrawTransition(doc._id, STAFF_ID, "Staff One", Role.STAFF);

    // Distinct from rejection: nobody declined it.
    expect(doc.status).toBe("WITHDRAWN");
  });

  it("refuses withdrawal by another staff member", async () => {
    h.requestFindById.mockResolvedValue(request());

    await expect(
      withdrawTransition(
        "64b7f0000000000000000b10",
        "64b7f0000000000000000b77",
        "Someone Else",
        Role.STAFF,
      ),
    ).rejects.toThrow(/only withdraw your own/);
  });

  it("refuses to withdraw one already decided", async () => {
    h.requestFindById.mockResolvedValue(request({ status: "APPROVED" }));

    await expect(
      withdrawTransition("any", STAFF_ID, "Staff One", Role.STAFF),
    ).rejects.toThrow(/already approved/);
  });
});

describe("superseding overtaken requests", () => {
  it("closes pending requests so the queue offers nothing stale", async () => {
    await supersedeForGrievance(GRIEVANCE_ID);

    expect(h.requestUpdateMany).toHaveBeenCalledWith(
      { grievanceId: GRIEVANCE_ID, status: "PENDING" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "SUPERSEDED" }),
      }),
    );
  });

  it("excludes the request that is causing the move", async () => {
    // Approving applies a move, which supersedes pending requests — including,
    // without this, the request being approved, telling its proposer it no longer
    // applies in the same breath as it was approved.
    await supersedeForGrievance(GRIEVANCE_ID, "64b7f0000000000000000b10");

    const [filter] = h.requestUpdateMany.mock.calls[0];
    expect(filter._id).toEqual({
      $ne: expect.objectContaining({ toString: expect.any(Function) }),
    });
  });
});

describe("a proposal for a move that needs evidence", () => {
  /** The same workflow, but its gated move also demands a file. */
  function evidenceWorkflow() {
    const wf = workflow();
    return {
      ...wf,
      transitions: wf.transitions.map((t) =>
        t.to === "RESOLVED" ? { ...t, requiresAttachment: true } : t,
      ),
    };
  }

  it("refuses the proposal when nothing is attached", async () => {
    const wf = evidenceWorkflow();
    h.workflowFindById.mockResolvedValue(wf);
    h.workflowFindOne.mockResolvedValue(wf);
    h.grievanceFindById.mockResolvedValue(grievance());
    h.attachmentCountDocuments.mockResolvedValue(0);

    await expect(
      proposeTransition(
        GRIEVANCE_ID,
        { to: "RESOLVED", reason: "Verified with the complainant" },
        STAFF.userId,
        STAFF.name,
        STAFF.role,
      ),
    ).rejects.toThrow(/requires at least one attachment as evidence/);
    // The approver must never be handed a request with nothing behind it.
    expect(h.requestCreate).not.toHaveBeenCalled();
  });

  // Evidence uploaded moments earlier is still unclaimed in storage; the
  // proposal claims it, and that satisfies the requirement.
  it("accepts evidence supplied with the proposal", async () => {
    const wf = evidenceWorkflow();
    h.workflowFindById.mockResolvedValue(wf);
    h.workflowFindOne.mockResolvedValue(wf);
    h.grievanceFindById.mockResolvedValue(grievance());
    h.attachmentCountDocuments.mockResolvedValue(1);

    await proposeTransition(
      GRIEVANCE_ID,
      { to: "RESOLVED", reason: "Verified with the complainant" },
      STAFF.userId,
      STAFF.name,
      STAFF.role,
      { attachmentKeys: ["abc/evidence.png"] },
    );

    expect(h.attachToGrievance).toHaveBeenCalledWith(
      GRIEVANCE_ID,
      [{ fileKey: "abc/evidence.png" }],
      expect.objectContaining({ userId: STAFF_ID }),
    );
    expect(h.requestCreate).toHaveBeenCalledOnce();
  });

  it("does not consult the evidence count for a move that needs none", async () => {
    h.grievanceFindById.mockResolvedValue(grievance());

    await proposeTransition(
      GRIEVANCE_ID,
      { to: "RESOLVED", reason: "Verified with the complainant" },
      STAFF.userId,
      STAFF.name,
      STAFF.role,
    );

    expect(h.attachmentCountDocuments).not.toHaveBeenCalled();
    expect(h.attachToGrievance).not.toHaveBeenCalled();
  });
});
