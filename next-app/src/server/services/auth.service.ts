import bcrypt from "bcryptjs";
import { ROLE_HIERARCHY, type Role } from "@/types";
import { ApiError } from "../api-error";
import { sendInvitationEmail, sendPasswordResetEmail } from "../email";
import { Invitation } from "../models/invitation.model";
import { PasswordResetToken } from "../models/password-reset-token.model";
import { User } from "../models/user.model";
import {
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,
  hashToken,
  verifyRefreshToken,
} from "../token";
import { AuditAction } from "./audit.service";
import { logAuthEvent, logUserEvent } from "./audit-impl";

const SALT_ROUNDS = 12;

export function publicUser(user: {
  _id: { toString(): string } | string;
  name: string;
  email: string;
  role: Role;
  title?: string;
  phone?: string;
  department?: string;
  lastLoginAt?: Date;
  isActive?: boolean;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    phone: user.phone,
    department: user.department,
    lastLoginAt: user.lastLoginAt,
  };
}

// ─── Login ──────────────────────────────────────────────────────────────────

export async function login(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+passwordHash",
  );

  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (!user.isActive) {
    throw ApiError.forbidden(
      "Account is deactivated. Contact an administrator.",
    );
  }

  const isPasswordValid = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );
  if (!isPasswordValid) {
    await logAuthEvent(AuditAction.LOGIN_FAILED, input.email.toLowerCase());
    throw ApiError.unauthorized("Invalid email or password");
  }

  user.lastLoginAt = new Date();
  await user.save();

  await logAuthEvent(
    AuditAction.LOGIN_SUCCESS,
    user.email,
    user._id.toString(),
  );

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    tokenVersion: 0,
  });

  return { user: publicUser(user), accessToken, refreshToken };
}

// ─── Role Helpers ────────────────────────────────────────────────────────────

/** Roles at or below `realRole` that it may switch into (stays in place, or previews a lower role). */
export function previewableRoles(realRole: Role): Role[] {
  return (Object.keys(ROLE_HIERARCHY) as Role[]).filter(
    (r) => ROLE_HIERARCHY[r] <= ROLE_HIERARCHY[realRole],
  );
}

// ─── Refresh Token ──────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  const user = await User.findById(payload.userId);
  if (!user) {
    throw ApiError.unauthorized("User not found");
  }

  if (!user.isActive) {
    throw ApiError.forbidden("Account is deactivated");
  }

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: (user.previewRole ?? user.role) as Role,
  });

  return { accessToken };
}

// ─── Switch Role (Preview) ──────────────────────────────────────────────────

export async function switchRole(userId: string, targetRole: Role) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  const realRole = user.role as Role;
  const previousPreview = user.previewRole ?? undefined;

  if (!previewableRoles(realRole).includes(targetRole)) {
    throw ApiError.forbidden("You cannot switch to that role");
  }

  const exiting = targetRole === realRole;
  user.previewRole = exiting ? undefined : targetRole;
  await user.save();

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: targetRole,
  });

  await logUserEvent(
    exiting
      ? AuditAction.ROLE_PREVIEW_EXITED
      : AuditAction.ROLE_PREVIEW_ENTERED,
    user._id.toString(),
    user._id.toString(),
    user.name,
    { from: previousPreview ?? realRole, to: targetRole },
  );

  return {
    user: {
      ...publicUser({ ...user.toObject(), role: targetRole }),
      previewRole: exiting ? undefined : targetRole,
    },
    accessToken,
  };
}

// ─── Forgot Password ────────────────────────────────────────────────────────

export async function forgotPassword(input: { email: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase() });
  if (!user) {
    return { message: "If the email exists, a reset link has been sent" };
  }

  await PasswordResetToken.deleteMany({ userId: user._id });

  const rawToken = generateSecureToken();
  const hashedToken = hashToken(rawToken);

  await PasswordResetToken.create({
    userId: user._id,
    token: hashedToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  await sendPasswordResetEmail(user.email, rawToken);

  return { message: "If the email exists, a reset link has been sent" };
}

// ─── Reset Password ─────────────────────────────────────────────────────────

export async function resetPassword(input: {
  token: string;
  password: string;
}) {
  const hashedToken = hashToken(input.token);

  const resetToken = await PasswordResetToken.findOne({
    token: hashedToken,
    usedAt: { $exists: false },
  }).select("+token");

  if (!resetToken) {
    throw ApiError.badRequest("Invalid or expired reset token");
  }

  if (resetToken.expiresAt < new Date()) {
    throw ApiError.badRequest("Reset token has expired");
  }

  const user = await User.findById(resetToken.userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  user.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  await user.save();

  resetToken.usedAt = new Date();
  await resetToken.save();

  await logAuthEvent(
    AuditAction.PASSWORD_RESET_COMPLETED,
    user.email,
    user._id.toString(),
  );

  return { message: "Password reset successful" };
}

// ─── Accept Invitation ──────────────────────────────────────────────────────

export async function acceptInvitation(input: {
  token: string;
  name?: string;
  phone?: string;
  title?: string;
  password: string;
}) {
  const hashedToken = hashToken(input.token);

  const invitation = await Invitation.findOne({
    token: hashedToken,
    acceptedAt: { $exists: false },
  }).select("+token");

  if (!invitation) {
    throw ApiError.badRequest("Invalid or expired invitation");
  }

  if (invitation.expiresAt < new Date()) {
    throw ApiError.badRequest("Invitation has expired");
  }

  const existingUser = await User.findOne({ email: invitation.email });
  if (existingUser) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await User.create({
    name: input.name?.trim() || invitation.name,
    email: invitation.email,
    phone: input.phone ?? invitation.phone,
    title: input.title ?? invitation.title,
    role: invitation.role,
    passwordHash,
    isActive: true,
  });

  invitation.acceptedAt = new Date();
  await invitation.save();

  await logUserEvent(
    AuditAction.INVITATION_ACCEPTED,
    user._id.toString(),
    user._id.toString(),
    user.name,
  );

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    tokenVersion: 0,
  });

  return { user: publicUser(user), accessToken, refreshToken };
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

  return {
    invitation: {
      id: invitation._id,
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
  };
}

// ─── Get Current User Profile ───────────────────────────────────────────────

export async function getProfile(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  return user;
}

// ─── Update Profile (Self) ──────────────────────────────────────────────────

export async function updateProfile(
  userId: string,
  input: { name?: string; phone?: string; title?: string; department?: string },
) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (input.name !== undefined) user.name = input.name;
  if (input.phone !== undefined) user.phone = input.phone ?? undefined;
  if (input.title !== undefined) user.title = input.title ?? undefined;
  if (input.department !== undefined)
    user.department = input.department ?? undefined;

  await user.save();

  await logUserEvent(AuditAction.PROFILE_UPDATED, user._id.toString());

  return user;
}

// ─── Change Password ────────────────────────────────────────────────────────

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  const isPasswordValid = await bcrypt.compare(
    currentPassword,
    user.passwordHash,
  );
  if (!isPasswordValid) {
    throw ApiError.unauthorized("Current password is incorrect");
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  return { message: "Password changed successfully" };
}
