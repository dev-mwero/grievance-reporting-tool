import bcrypt from "bcryptjs";
import { Role } from "@/types";
import { ApiError } from "../api-error";
import { sendInvitationEmail } from "../email";
import { Invitation } from "../models/invitation.model";
import { User } from "../models/user.model";
import { generateSecureToken, hashToken } from "../token";
import { AuditAction } from "./audit.service";
import { logUserEvent } from "./audit-impl";

const SALT_ROUNDS = 12;

// ─── List Users ─────────────────────────────────────────────────────────────

export async function listUsers(query: {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  isActive?: string;
}) {
  const { page, limit, search, role, isActive } = query;

  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (role) filter.role = role;

  if (isActive) filter.isActive = isActive === "true";

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
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

export async function getUserById(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  return user;
}

// ─── Create User (Admin) ────────────────────────────────────────────────────

export async function createUser(input: {
  name: string;
  email: string;
  phone?: string;
  role: Role;
  title?: string;
  department?: string;
  password: string;
}) {
  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict("A user with this email already exists");
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
) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (input.isActive === false && user.role === Role.SUPER_ADMIN) {
    const superAdminCount = await User.countDocuments({
      role: Role.SUPER_ADMIN,
      isActive: true,
    });
    if (superAdminCount <= 1) {
      throw ApiError.badRequest(
        "Cannot deactivate the last active Super Admin",
      );
    }
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
    const superAdminCount = await User.countDocuments({
      role: Role.SUPER_ADMIN,
      isActive: true,
    });
    if (superAdminCount <= 1) {
      throw ApiError.badRequest(
        "Cannot deactivate the last active Super Admin",
      );
    }
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
) {
  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict("A user with this email already exists");
  }

  const existingInvitation = await Invitation.findOne({
    email: input.email.toLowerCase(),
    acceptedAt: { $exists: false },
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

  return invitation;
}

// ─── List Invitations ───────────────────────────────────────────────────────

export async function listInvitations(query: {
  page: number;
  limit: number;
  status?: "pending" | "accepted" | "expired";
}) {
  const { page, limit, status } = query;

  const filter: Record<string, unknown> = {};

  if (status === "pending") {
    filter.acceptedAt = { $exists: false };
    filter.expiresAt = { $gt: new Date() };
  } else if (status === "accepted") {
    filter.acceptedAt = { $exists: true };
  } else if (status === "expired") {
    filter.acceptedAt = { $exists: false };
    filter.expiresAt = { $lte: new Date() };
  }

  const [invitations, total] = await Promise.all([
    Invitation.find(filter)
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Invitation.countDocuments(filter),
  ]);

  return {
    invitations,
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
  const invitation = await Invitation.findById(invitationId);
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

// ─── Revoke Invitation ──────────────────────────────────────────────────────

export async function revokeInvitation(invitationId: string) {
  const invitation = await Invitation.findById(invitationId);
  if (!invitation) {
    throw ApiError.notFound("Invitation not found");
  }

  if (invitation.acceptedAt) {
    throw ApiError.badRequest("Cannot revoke an accepted invitation");
  }

  await invitation.deleteOne();
  return { message: "Invitation revoked" };
}
