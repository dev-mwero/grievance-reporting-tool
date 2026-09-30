import { beforeEach, describe, expect, it, vi } from "vitest";
import { GrievanceStatus } from "@/types";

const h = vi.hoisted(() => ({
  grievanceFindById: vi.fn(),
  grievanceUpdateCreate: vi.fn(),
  assignmentFindById: vi.fn(),
  assignmentCreate: vi.fn(),
  assignmentUpdateMany: vi.fn(),
  userFindById: vi.fn(),
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

/** Stand-in for a mongoose document, recording the fields updateStatus writes. */
function fakeGrievance(over: Record<string, unknown> = {}) {
  return {
    _id: GRIEVANCE_ID,
    referenceCode: "GRV-2026-AABBCCDD",
    status: GrievanceStatus.RESOLVED,
    primaryAssigneeId: undefined,
    acknowledgedAt: undefined as Date | undefined,
    resolvedAt: new Date("2026-01-01") as Date | undefined,
    closedAt: undefined as Date | undefined,
    deletedAt: undefined as Date | undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.grievanceUpdateCreate.mockResolvedValue({});
  h.logGrievanceEvent.mockResolvedValue(undefined);
  h.createNotifications.mockResolvedValue(undefined);
});

describe("updateStatus stamps", () => {
  // The regression this guards: RESOLVED → IN_PROGRESS is a reopen, and
  // leaving resolvedAt set made getAvgResolutionDays keep counting a case that
  // was open again as resolved.
  it("clears resolvedAt when a resolved case is reopened", async () => {
    const doc = fakeGrievance();
    h.grievanceFindById.mockResolvedValue(doc);

    await updateStatus(
      GRIEVANCE_ID,
      { status: GrievanceStatus.IN_PROGRESS, note: "Reopened" },
      USER_ID,
      "Staff One",
    );

    expect(doc.resolvedAt).toBeUndefined();
    expect(doc.save).toHaveBeenCalledOnce();
  });

  // CLOSED is currently terminal — the table has no outgoing edges from it.
  // This is the gap the configurable workflow is meant to close, since the
  // product requirement is that an admin can reopen a closed case.
  it("treats CLOSED as terminal, so a closed case cannot be reopened yet", async () => {
    const doc = fakeGrievance({
      status: GrievanceStatus.CLOSED,
      closedAt: new Date("2026-01-02"),
      resolvedAt: new Date("2026-01-01"),
    });
    h.grievanceFindById.mockResolvedValue(doc);

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: GrievanceStatus.IN_PROGRESS },
        USER_ID,
        "Staff One",
      ),
    ).rejects.toThrow(/Cannot transition from CLOSED/);
    expect(doc.save).not.toHaveBeenCalled();
  });

  // The converse: the stamp has to survive the transition that sets it, or
  // resolution times would never be recorded at all.
  it("stamps resolvedAt on the transition into RESOLVED", async () => {
    const doc = fakeGrievance({ status: GrievanceStatus.IN_PROGRESS });
    h.grievanceFindById.mockResolvedValue(doc);

    await updateStatus(
      GRIEVANCE_ID,
      { status: GrievanceStatus.RESOLVED },
      USER_ID,
      "Staff One",
    );

    expect(doc.resolvedAt).toBeInstanceOf(Date);
  });

  it("stamps closedAt on the transition into CLOSED", async () => {
    const doc = fakeGrievance({ status: GrievanceStatus.RESOLVED });
    h.grievanceFindById.mockResolvedValue(doc);

    await updateStatus(
      GRIEVANCE_ID,
      { status: GrievanceStatus.CLOSED },
      USER_ID,
      "Staff One",
    );

    expect(doc.closedAt).toBeInstanceOf(Date);
    expect(doc.resolvedAt).toBeUndefined();
  });

  it("refuses a transition the table does not allow", async () => {
    const doc = fakeGrievance({ status: GrievanceStatus.CLOSED });
    h.grievanceFindById.mockResolvedValue(doc);

    await expect(
      updateStatus(
        GRIEVANCE_ID,
        { status: GrievanceStatus.IN_PROGRESS },
        USER_ID,
        "Staff One",
      ),
    ).rejects.toThrow(/Cannot transition/);
    expect(doc.save).not.toHaveBeenCalled();
  });
});
