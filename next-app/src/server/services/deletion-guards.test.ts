import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api-error";
import { Role } from "@/types";

const h = vi.hoisted(() => ({
  userFindById: vi.fn(),
  userCount: vi.fn(),
  assignmentDeleteMany: vi.fn(),
  notificationDeleteMany: vi.fn(),
  invitationDeleteMany: vi.fn(),
  invitationFindById: vi.fn(),
  passwordResetDeleteMany: vi.fn(),
  grievanceUpdateMany: vi.fn(),
  subCountyFindById: vi.fn(),
  wardCount: vi.fn(),
  wardDeleteMany: vi.fn(),
  auditLog: vi.fn(),
}));

const noop = () => ({ deletedCount: 0, modifiedCount: 0 });

vi.mock("@/server/models/user.model", () => ({
  User: { findById: h.userFindById, countDocuments: h.userCount },
}));
vi.mock("@/server/models/grievance-assignment.model", () => ({
  GrievanceAssignment: { deleteMany: h.assignmentDeleteMany },
}));
vi.mock("@/server/models/notification.model", () => ({
  Notification: { deleteMany: h.notificationDeleteMany },
}));
vi.mock("@/server/models/invitation.model", () => ({
  Invitation: {
    findById: h.invitationFindById,
    deleteMany: h.invitationDeleteMany,
  },
}));
vi.mock("@/server/models/password-reset-token.model", () => ({
  PasswordResetToken: { deleteMany: h.passwordResetDeleteMany },
}));
vi.mock("@/server/models/grievance.model", () => ({
  Grievance: { updateMany: h.grievanceUpdateMany },
}));
vi.mock("@/server/models/sub-county.model", () => ({
  SubCounty: { findById: h.subCountyFindById },
}));
vi.mock("@/server/models/ward.model", () => ({
  Ward: { countDocuments: h.wardCount, deleteMany: h.wardDeleteMany },
}));

vi.mock("@/server/services/audit-impl", () => ({
  auditService: { log: h.auditLog },
  logUserEvent: vi.fn(),
  logSubCountyEvent: vi.fn(),
  logWardEvent: vi.fn(),
}));

vi.mock("@/server/email", () => ({ sendInvitationEmail: vi.fn() }));
vi.mock("@/server/token", () => ({
  generateSecureToken: () => "raw",
  hashToken: (t: string) => t,
}));

import {
  purgeSubCounty,
  softDeleteSubCounty,
} from "@/server/services/locations.service";
import {
  purgeUser,
  restoreUser,
  revokeInvitation,
  softDeleteUser,
} from "@/server/services/users.service";

const ACTOR = "64b7f0000000000000000a01";
const OTHER = "64b7f0000000000000000a02";
const TARGET = "64b7f0000000000000000a03";

const actor = { id: ACTOR, name: "Admin One" };
const otherActor = { id: OTHER, name: "Admin Two" };

/** Stand-in for a mongoose document, recording the writes deletion applies. */
function fakeDoc(over: Record<string, unknown> = {}) {
  return {
    _id: TARGET,
    name: "Test Record",
    email: "a@b.c",
    role: Role.STAFF,
    isActive: true,
    // Written by the shared deletion helpers, so the fake declares them up front.
    deletedAt: undefined as Date | undefined,
    deleteReason: undefined as string | undefined,
    save: vi.fn().mockResolvedValue(undefined),
    deleteOne: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of [
    h.auditLog,
    h.assignmentDeleteMany,
    h.notificationDeleteMany,
    h.invitationDeleteMany,
    h.passwordResetDeleteMany,
    h.grievanceUpdateMany,
    h.wardDeleteMany,
  ]) {
    m.mockResolvedValue(noop());
  }
  h.userCount.mockResolvedValue(0);
  h.wardCount.mockResolvedValue(0);
});

// ─── User guards ────────────────────────────────────────────────────────────

describe("user deletion guards", () => {
  it("blocks deleting your own account", async () => {
    const target = fakeDoc();
    h.userFindById.mockResolvedValue(target);
    await expect(softDeleteUser(ACTOR, actor)).rejects.toThrow(/own account/i);
    expect(target.save).not.toHaveBeenCalled();
  });

  it("blocks purging your own account", async () => {
    const target = fakeDoc();
    h.userFindById.mockResolvedValue(target);
    await expect(purgeUser(ACTOR, actor)).rejects.toThrow(/own account/i);
    expect(target.deleteOne).not.toHaveBeenCalled();
  });

  it("blocks restoring your own account", async () => {
    const target = fakeDoc({ deletedAt: new Date() });
    h.userFindById.mockResolvedValue(target);
    await expect(restoreUser(ACTOR, actor)).rejects.toThrow(/own account/i);
  });

  it("deactivates the account as part of the soft delete", async () => {
    const target = fakeDoc();
    h.userFindById.mockResolvedValue(target);
    await softDeleteUser(TARGET, otherActor);
    expect(target.isActive).toBe(false);
    expect(target.deletedAt).toBeInstanceOf(Date);
  });

  it("records the reason on the document", async () => {
    const target = fakeDoc();
    h.userFindById.mockResolvedValue(target);
    await softDeleteUser(TARGET, otherActor, "left the county");
    expect(target.deleteReason).toBe("left the county");
  });

  it("blocks removing the last active super admin", async () => {
    h.userCount.mockResolvedValue(1);
    const target = fakeDoc({ role: Role.SUPER_ADMIN });
    h.userFindById.mockResolvedValue(target);
    await expect(softDeleteUser(TARGET, otherActor)).rejects.toThrow(
      /last active Super Admin/i,
    );
    expect(target.save).not.toHaveBeenCalled();
  });

  it("allows removing a super admin when another one remains", async () => {
    h.userCount.mockResolvedValue(2);
    const target = fakeDoc({ role: Role.SUPER_ADMIN });
    h.userFindById.mockResolvedValue(target);
    await softDeleteUser(TARGET, otherActor);
    expect(target.save).toHaveBeenCalledTimes(1);
  });

  it("does not apply the super admin guard to ordinary staff", async () => {
    h.userCount.mockResolvedValue(1);
    const target = fakeDoc({ role: Role.STAFF });
    h.userFindById.mockResolvedValue(target);
    await softDeleteUser(TARGET, otherActor);
    expect(h.userCount).not.toHaveBeenCalled();
  });

  it("counts only live super admins when enforcing the guard", async () => {
    // A soft-deleted super admin must not keep the system from losing its last
    // usable administrator.
    h.userCount.mockResolvedValue(0);
    const target = fakeDoc({ role: Role.SUPER_ADMIN });
    h.userFindById.mockResolvedValue(target);
    await expect(purgeUser(TARGET, otherActor)).rejects.toThrow(
      /permanently delete the last active Super Admin/i,
    );
    expect(h.userCount).toHaveBeenCalledWith({
      role: Role.SUPER_ADMIN,
      isActive: true,
      deletedAt: { $exists: false },
    });
  });
});

describe("user purge cascade", () => {
  it("cleans up every record that references the user", async () => {
    const target = fakeDoc();
    h.userFindById.mockResolvedValue(target);
    await purgeUser(TARGET, otherActor);

    expect(h.assignmentDeleteMany).toHaveBeenCalledWith({
      $or: [{ assigneeId: TARGET }, { assignedBy: TARGET }],
    });
    expect(h.notificationDeleteMany).toHaveBeenCalledWith({
      recipientId: TARGET,
    });
    expect(h.invitationDeleteMany).toHaveBeenCalledWith({
      invitedBy: TARGET,
    });
    expect(h.passwordResetDeleteMany).toHaveBeenCalledWith({
      userId: TARGET,
    });
    expect(h.grievanceUpdateMany).toHaveBeenCalledWith(
      { primaryAssigneeId: TARGET },
      { $unset: { primaryAssigneeId: 1 } },
    );
    expect(h.grievanceUpdateMany).toHaveBeenCalledWith(
      { supportingAssignees: TARGET },
      { $pull: { supportingAssignees: TARGET } },
    );
    expect(target.deleteOne).toHaveBeenCalledTimes(1);
  });
});

// ─── Sub-County guards ──────────────────────────────────────────────────────

describe("sub-county purge guard", () => {
  it("refuses to purge a sub-county that still has live wards", async () => {
    h.wardCount.mockResolvedValue(3);
    const target = fakeDoc({ name: "Kisumu Central", code: "KC" });
    h.subCountyFindById.mockResolvedValue(target);
    await expect(purgeSubCounty(TARGET, otherActor)).rejects.toThrow(
      /still reference it/i,
    );
    expect(target.deleteOne).not.toHaveBeenCalled();
  });

  it("names the blocking ward count so the admin knows what to clear", async () => {
    h.wardCount.mockResolvedValue(2);
    h.subCountyFindById.mockResolvedValue(fakeDoc());
    await expect(purgeSubCounty(TARGET, otherActor)).rejects.toThrow(/2 ward/);
  });

  it("counts only live wards, ignoring ones already deleted", async () => {
    h.wardCount.mockResolvedValue(0);
    h.subCountyFindById.mockResolvedValue(fakeDoc());
    await purgeSubCounty(TARGET, otherActor).catch(() => undefined);
    expect(h.wardCount).toHaveBeenCalledWith({
      subCountyId: TARGET,
      deletedAt: { $exists: false },
    });
  });

  it("deactivates the sub-county on soft delete", async () => {
    const target = fakeDoc({ name: "Kisumu Central", code: "KC" });
    h.subCountyFindById.mockResolvedValue(target);
    await softDeleteSubCounty(TARGET, otherActor);
    expect(target.isActive).toBe(false);
  });
});

// ─── Invitation revocation ──────────────────────────────────────────────────

describe("invitation revocation", () => {
  it("refuses to revoke an invitation that was already accepted", async () => {
    // Accepting created a real account; revoking would orphan it.
    const target = fakeDoc({ acceptedAt: new Date() });
    h.invitationFindById.mockResolvedValue(target);
    await expect(revokeInvitation(TARGET, otherActor)).rejects.toThrow(
      /accepted invitation/i,
    );
    expect(target.save).not.toHaveBeenCalled();
  });

  it("allows revoking a pending invitation", async () => {
    const target = fakeDoc();
    h.invitationFindById.mockResolvedValue(target);
    await revokeInvitation(TARGET, otherActor);
    expect(target.save).toHaveBeenCalledTimes(1);
  });

  it("reports a missing record as not found", async () => {
    h.invitationFindById.mockResolvedValue(null);
    await expect(revokeInvitation("nope", otherActor)).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
