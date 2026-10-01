import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  subCountyFindOne: vi.fn(),
  wardFindOne: vi.fn(),
  categoryFindOne: vi.fn(),
  grievanceCreate: vi.fn(),
  grievanceDeleteOne: vi.fn(),
  claimPublicUploads: vi.fn(),
  reap: vi.fn(),
  sanitizeRichText: vi.fn((s: string) => s),
  logEvent: vi.fn(),
  notify: vi.fn(),
  adminFind: vi.fn(),
  after: vi.fn(),
}));

vi.mock("@/server/models/sub-county.model", () => ({
  SubCounty: { findOne: h.subCountyFindOne },
}));
vi.mock("@/server/models/ward.model", () => ({
  Ward: { findOne: h.wardFindOne },
}));
vi.mock("@/server/models/grievance-category.model", () => ({
  GrievanceCategory: { findOne: h.categoryFindOne },
}));
vi.mock("@/server/models/grievance.model", () => ({
  Grievance: {
    create: h.grievanceCreate,
    deleteOne: h.grievanceDeleteOne,
  },
}));
vi.mock("@/server/models/grievance-update.model", () => ({
  GrievanceUpdate: { find: vi.fn() },
}));
vi.mock("@/server/models/user.model", () => ({ User: { find: h.adminFind } }));
vi.mock("@/server/models/soft-delete", () => ({ deletionFilter: () => ({}) }));
vi.mock("@/server/sanitize", () => ({
  sanitizeRichText: h.sanitizeRichText,
}));
vi.mock("@/server/services/attachments.service", () => ({
  claimPublicUploads: h.claimPublicUploads,
}));
vi.mock("@/server/services/attachment-reaper", () => ({
  reapExpiredPublicUploads: h.reap,
}));
vi.mock("@/server/services/audit-impl", () => ({
  logGrievanceEvent: h.logEvent,
}));
vi.mock("@/server/services/notification.service", () => ({
  createNotifications: h.notify,
}));
vi.mock("@/server/services/workflows.service", () => ({
  loadStageLabels: vi.fn(),
  resolveWorkflowForCategory: vi.fn(async () => ({
    _id: "wf1",
    startStageKey: "SUBMITTED",
  })),
}));
vi.mock("@/server/email", () => ({ sendGrievanceSubmittedEmail: vi.fn() }));
vi.mock("next/server", () => ({ after: h.after }));

import { submitGrievance } from "@/server/services/public.service";

const CAPABILITY = {
  submissionId: "6800a1b2c3d4e5f60718293a",
  expiresAt: Date.now() + 60 * 60 * 1000,
};

const VALID = {
  subCountyId: "sc1",
  wardId: "w1",
  categoryId: "c1",
  description: "Road potholes on Majengo street",
};

function createdGrievance(over: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => "64b7f0000000000000000c01" },
    referenceCode: "GRV-2026-CCDDEEFF",
    submittedAt: new Date("2026-03-01T10:00:00Z"),
    status: "SUBMITTED",
    subCountyName: "Nairobi West",
    wardName: "Kangemi",
    categoryName: "Roads",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.subCountyFindOne.mockResolvedValue({
    name: "Nairobi West",
    isActive: true,
  });
  h.wardFindOne.mockResolvedValue({
    name: "Kangemi",
    isActive: true,
    subCountyId: { toString: () => "sc1" },
  });
  h.categoryFindOne.mockResolvedValue({ name: "Roads", isActive: true });
  h.grievanceCreate.mockImplementation(
    async (doc: Record<string, unknown> = {}) => createdGrievance(doc),
  );
  h.grievanceDeleteOne.mockResolvedValue({});
  h.claimPublicUploads.mockResolvedValue([]);
  h.reap.mockResolvedValue(0);
  h.adminFind.mockReturnValue({
    select: () => ({
      sort: () => ({ limit: () => ({ lean: async () => [] }) }),
    }),
  });
});

describe("submitting a grievance without evidence", () => {
  it("creates the complaint and claims nothing", async () => {
    await submitGrievance(VALID);

    expect(h.grievanceCreate).toHaveBeenCalledOnce();
    expect(h.claimPublicUploads).not.toHaveBeenCalled();
  });

  // An empty list is the same as none: a form that renders no files must not
  // reach into the claim path.
  it("treats an empty key list as no evidence", async () => {
    await submitGrievance({
      ...VALID,
      evidence: { fileKeys: [], capability: CAPABILITY },
    });

    expect(h.claimPublicUploads).not.toHaveBeenCalled();
  });
});

describe("submitting a grievance with evidence", () => {
  it("claims the uploaded files against the new complaint", async () => {
    await submitGrievance({
      ...VALID,
      evidence: {
        fileKeys: ["pub/a.png", "pub/b.pdf"],
        capability: CAPABILITY,
      },
    });

    expect(h.claimPublicUploads).toHaveBeenCalledWith(
      "64b7f0000000000000000c01",
      [{ fileKey: "pub/a.png" }, { fileKey: "pub/b.pdf" }],
      CAPABILITY,
    );
  });

  // A complaint that exists without the evidence the submitter was told had been
  // attached is worse than a failed submission: they have a reference code, they
  // believe their photos are on it, and nobody would look.
  it("rolls the complaint back when the claim fails", async () => {
    h.claimPublicUploads.mockRejectedValue(new Error("claim refused"));

    await expect(
      submitGrievance({
        ...VALID,
        evidence: { fileKeys: ["pub/a.png"], capability: CAPABILITY },
      }),
    ).rejects.toThrow("claim refused");

    expect(h.grievanceDeleteOne).toHaveBeenCalledWith({
      _id: expect.objectContaining({}),
    });
    // The audit entry and the notifications would otherwise describe a complaint
    // that no longer exists.
    expect(h.logEvent).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("still rethrows when the rollback itself fails", async () => {
    h.claimPublicUploads.mockRejectedValue(new Error("claim refused"));
    h.grievanceDeleteOne.mockRejectedValue(new Error("db down"));

    await expect(
      submitGrievance({
        ...VALID,
        evidence: { fileKeys: ["pub/a.png"], capability: CAPABILITY },
      }),
    ).rejects.toThrow("claim refused");
  });
});
