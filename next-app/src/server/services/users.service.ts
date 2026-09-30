import bcrypt from "bcryptjs";
import { Role } from "@/types";
import { ApiError } from "../api-error";
import { sendInvitationEmail } from "../email";
import { Grievance } from "../models/grievance.model";
import { GrievanceAssignment } from "../models/grievance-assignment.model";
import { type IInvitation, Invitation } from "../models/invitation.model";
import { Notification } from "../models/notification.model";
import { PasswordResetToken } from "../models/password-reset-token.model";
import { type DeletionScope, deletionFilter } from "../models/soft-delete";
import { type IUser, User } from "../models/user.model";
import { generateSecureToken, hashToken } from "../token";
import { AuditAction } from "./audit.service";
import { logUserEvent } from "./audit-impl";
import {
  type DeletionActor,
  type DeletionHooks,
  type DeletionTarget,
  purgeRecord,
  restoreRecord,
  softDeleteRecord,
} from "./deletion.service";

const SALT_ROUNDS = 12;

/**
 * Guard the last usable system admin. Deleting, deactivating or demoting the
 * final super admin would leave the system with nobody able to administer it,
 * so every path that reduces the active super-admin count runs this first.
 */
async function assertNotLastSuperAdmin(
  message = "Cannot remove the last active Super Admin",
): Promise<void> {
  const count = await User.countDocuments({
    role: Role.SUPER_ADMIN,
    isActive: true,
    ...deletionFilter(),
  });
  if (count <= 1) {
    throw ApiError.badRequest(message);
  }
}

/** Blocking self-removal avoids locking an admin out of their own account. */
function assertNotSelf(
  actorId: string,
  targetId: string,
  action: string,
): void {
  if (actorId === targetId) {
    throw ApiError.badRequest(`You cannot ${action} your own account`);
  }
}

// ─── List Users ─────────────────────────────────────────────────────────────

export async function listUsers(
  query: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    isActive?: string;
    deletionScope?: DeletionScope;
  },
  viewerRole?: Role,
) {
  const { page, limit, search, role, isActive, deletionScope } = query;

  const filter: Record<string, unknown> = { ...deletionFilter(deletionScope) };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (role) filter.role = role;

  // System admins are only visible to other system admins.
  if (viewerRole !== Role.SUPER_ADMIN) {
    filter.role = { $ne: Role.SUPER_ADMIN };
  }

  if (isActive) filter.isActive = isActive === "true";

  const countFilter = { ...filter };
  if (!countFilter.role) countFilter.role = { $ne: Role.SUPER_ADMIN };

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate("deletedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(countFilter),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─── Get User ───────────────────────────────────────────────────────────────

export async function getUserById(
  userId: string,
  { includeDeleted = false }: { includeDeleted?: boolean } = {},
) {
  const user = await User.findOne({
    _id: userId,
    ...(includeDeleted ? {} : deletionFilter()),
  });
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  return user;
}

// ─── Create User (Admin) ────────────────────────────────────────────────────

export async function createUser(
  input: {
    name: string;
    email: string;
    phone?: string;
    role: Role;
    title?: string;
    department?: string;
    password: string;
  },
  viewerRole?: Role,
) {
  if (input.role === Role.SUPER_ADMIN && viewerRole !== Role.SUPER_ADMIN) {
    throw ApiError.forbidden(
      "Only system admins can create other system admins",
    );
  }

  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict(
      existingUser.deletedAt
        ? "A user with this email exists but is deleted — restore or permanently delete them first"
        : "A user with this email already exists",
    );
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await User.create({
    ...input,
    email: input.email.toLowerCase(),
    passwordHash,
    isActive: true,
  });

  await logUserEvent(
    AuditAction.USER_CREATED,
    user._id.toString(),
    undefined,
    undefined,
    { email: user.email, role: user.role },
  );

  return user;
}

// ─── Update User (Admin) ────────────────────────────────────────────────────

export async function updateUser(
  userId: string,
  input: Record<string, unknown>,
  operatorRole?: Role,
) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (user.role === Role.SUPER_ADMIN && operatorRole !== Role.SUPER_ADMIN) {
    throw ApiError.forbidden(
      "Only system admins can modify system admin accounts",
    );
  }

  if (user.deletedAt) {
    throw ApiError.badRequest(
      "Cannot edit a deleted user — restore the account first",
    );
  }

  if (input.role === Role.SUPER_ADMIN && operatorRole !== Role.SUPER_ADMIN) {
    throw ApiError.forbidden(
      "Only system admins can promote a user to system admin",
    );
  }

  if (input.isActive === false && user.role === Role.SUPER_ADMIN) {
    await assertNotLastSuperAdmin();
  }

  Object.assign(user, input);
  await user.save();

  await logUserEvent(
    AuditAction.USER_UPDATED,
    user._id.toString(),
    undefined,
    undefined,
    { changes: Object.keys(input) },
  );

  return user;
}

// ─── Deactivate User ────────────────────────────────────────────────────────

export async function deactivateUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (user.role === Role.SUPER_ADMIN) {
    await assertNotLastSuperAdmin(
      "Cannot deactivate the last active Super Admin",
    );
  }

  user.isActive = false;
  await user.save();

  await logUserEvent(
    AuditAction.USER_DEACTIVATED,
    user._id.toString(),
    undefined,
    undefined,
  );

  return user;
}

// ─── Soft Delete / Restore / Purge User ─────────────────────────────────────

const userTarget: DeletionTarget<IUser> = {
  label: "User",
  entityType: "User",
  model: User,
};

const userActions = {
  softDelete: AuditAction.USER_SOFT_DELETED,
  restore: AuditAction.USER_RESTORED,
  purge: AuditAction.USER_PURGED,
};

const userHooks: DeletionHooks<IUser> = {
  beforeSoftDelete: async (doc) => {
    if (doc.role === Role.SUPER_ADMIN) await assertNotLastSuperAdmin();
    doc.isActive = false;
  },
  beforeRestore: (doc) => {
    doc.isActive = true;
  },
  beforePurge: async (doc) => {
    if (doc.role === Role.SUPER_ADMIN) {
      await assertNotLastSuperAdmin(
        "Cannot permanently delete the last active Super Admin",
      );
    }
  },
  // A purged user leaves no dangling references behind: their assignments and
  // notifications go, pending password resets and issued invitations go, and
  // any grievance still pointing at them is unassigned rather than left
  // pointing at a document that no longer exists.
  cascadePurge: async (doc) => {
    const userId = doc._id;
    await GrievanceAssignment.deleteMany({
      $or: [{ assigneeId: userId }, { assignedBy: userId }],
    });
    await Notification.deleteMany({ recipientId: userId });
    await Invitation.deleteMany({ invitedBy: userId });
    await PasswordResetToken.deleteMany({ userId });
    await Grievance.updateMany(
      { primaryAssigneeId: userId },
      { $unset: { primaryAssigneeId: 1 } },
    );
    await Grievance.updateMany(
      { supportingAssignees: userId },
      { $pull: { supportingAssignees: userId } },
    );
  },
  metadata: (doc) => ({ name: doc.name, email: doc.email, role: doc.role }),
};

export async function softDeleteUser(
  userId: string,
  actor: DeletionActor,
  reason?: string,
) {
  assertNotSelf(actor.id, userId, "delete");
  return softDeleteRecord(
    userTarget,
    userActions,
    userId,
    actor,
    userHooks,
    reason,
  );
}

export async function restoreUser(userId: string, actor: DeletionActor) {
  assertNotSelf(actor.id, userId, "restore");
  return restoreRecord(userTarget, userActions, userId, actor, userHooks);
}

export async function purgeUser(userId: string, actor: DeletionActor) {
  assertNotSelf(actor.id, userId, "permanently delete");
  return purgeRecord(userTarget, userActions, userId, actor, userHooks);
}

// ─── Create Invitation (Admin) ──────────────────────────────────────────────

export async function createInvitation(
  input: {
    email: string;
    name: string;
    phone?: string;
    title?: string;
    role: Role;
  },
  invitedByUserId: string,
  viewerRole?: Role,
) {
  if (input.role === Role.SUPER_ADMIN && viewerRole !== Role.SUPER_ADMIN) {
    throw ApiError.forbidden(
      "Only system admins can invite other system admins",
    );
  }

  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict(
      existingUser.deletedAt
        ? "A user with this email exists but is deleted — restore or permanently delete them first"
        : "A user with this email already exists",
    );
  }

  const existingInvitation = await Invitation.findOne({
    email: input.email.toLowerCase(),
    acceptedAt: { $exists: false },
    ...deletionFilter(),
  });
  if (existingInvitation) {
    throw ApiError.conflict(
      "A pending invitation already exists for this email",
    );
  }

  const rawToken = generateSecureToken();
  const hashedToken = hashToken(rawToken);

  const invitation = await Invitation.create({
    ...input,
    email: input.email.toLowerCase(),
    token: hashedToken,
    invitedBy: invitedByUserId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await sendInvitationEmail(invitation.email, invitation.name, rawToken);

  await logUserEvent(
    AuditAction.INVITATION_SENT,
    invitation._id.toString(),
    invitedByUserId,
    undefined,
    { email: invitation.email, role: invitation.role },
  );

  return invitation;
}

// ─── List Invitations ───────────────────────────────────────────────────────

export async function listInvitations(
  query: {
    page: number;
    limit: number;
    status?: "pending" | "accepted" | "expired";
    deletionScope?: DeletionScope;
  },
  viewerRole?: Role,
) {
  const { page, limit, status, deletionScope } = query;

  const filter: Record<string, unknown> = { ...deletionFilter(deletionScope) };

  if (status === "pending") {
    filter.acceptedAt = { $exists: false };
    filter.expiresAt = { $gt: new Date() };
  } else if (status === "accepted") {
    filter.acceptedAt = { $exists: true };
  } else if (status === "expired") {
    filter.acceptedAt = { $exists: false };
    filter.expiresAt = { $lte: new Date() };
  }

  // System admin invitations are only visible to other system admins.
  if (viewerRole !== Role.SUPER_ADMIN) {
    filter.role = { $ne: Role.SUPER_ADMIN };
  }

  const [invitations, total] = await Promise.all([
    Invitation.find(filter)
      .populate("invitedBy", "name email")
      .populate("deletedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Invitation.countDocuments(filter),
  ]);

  const now = Date.now();

  return {
    invitations: invitations.map((invitation) => {
      const doc = invitation.toObject();
      const accepted = Boolean(doc.acceptedAt);
      const expired = !accepted && doc.expiresAt.getTime() <= now;
      return {
        ...doc,
        status: doc.deletedAt
          ? "deleted"
          : accepted
            ? "accepted"
            : expired
              ? "expired"
              : "pending",
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─── Resend Invitation ──────────────────────────────────────────────────────

export async function resendInvitation(invitationId: string) {
  const invitation = await Invitation.findOne({
    _id: invitationId,
    ...deletionFilter(),
  });
  if (!invitation) {
    throw ApiError.notFound("Invitation not found");
  }

  if (invitation.acceptedAt) {
    throw ApiError.badRequest("Invitation has already been accepted");
  }

  const rawToken = generateSecureToken();
  const hashedToken = hashToken(rawToken);

  invitation.token = hashedToken;
  invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await invitation.save();

  await sendInvitationEmail(invitation.email, invitation.name, rawToken);

  return invitation;
}

// ─── Revoke / Restore / Purge Invitation ────────────────────────────────────

const invitationTarget: DeletionTarget<IInvitation> = {
  label: "Invitation",
  entityType: "Invitation",
  model: Invitation,
};

const invitationActions = {
  softDelete: AuditAction.INVITATION_SOFT_DELETED,
  restore: AuditAction.INVITATION_RESTORED,
  purge: AuditAction.INVITATION_PURGED,
};

const invitationHooks: DeletionHooks<IInvitation> = {
  // An accepted invitation has already produced a user account, so revoking
  // it would orphan that account. The account itself is the thing to delete.
  beforeSoftDelete: (doc) => {
    if (doc.acceptedAt) {
      throw ApiError.badRequest("Cannot revoke an accepted invitation");
    }
  },
  metadata: (doc) => ({ email: doc.email, role: doc.role }),
};

/**
 * Revoke a pending invitation. This soft-deletes rather than removing, so a
 * mistaken revoke can be undone; use purge to destroy the record for good.
 */
export async function revokeInvitation(
  invitationId: string,
  actor: DeletionActor,
  reason?: string,
) {
  return softDeleteRecord(
    invitationTarget,
    invitationActions,
    invitationId,
    actor,
    invitationHooks,
    reason,
  );
}

export async function restoreInvitation(
  invitationId: string,
  actor: DeletionActor,
) {
  return restoreRecord(
    invitationTarget,
    invitationActions,
    invitationId,
    actor,
    invitationHooks,
  );
}

export async function purgeInvitation(
  invitationId: string,
  actor: DeletionActor,
) {
  return purgeRecord(
    invitationTarget,
    invitationActions,
    invitationId,
    actor,
    invitationHooks,
  );
}
