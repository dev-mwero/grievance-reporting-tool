import bcrypt from 'bcryptjs';
import { Role } from 'shared';
import { User } from '../../models/user.model';
import { Invitation } from '../../models/invitation.model';
import { generateSecureToken, hashToken } from '../../utils/token';
import { ApiError } from '../../utils/api-error';
import { env } from '../../config/env';
import { logUserEvent } from '../../services/audit-impl';
import { AuditAction } from '../../services/audit.service';
import type {
  ListUsersQuery,
  CreateUserInput,
  UpdateUserInput,
  CreateInvitationInput,
  ListInvitationsQuery,
} from './users.validation';

const SALT_ROUNDS = 12;

// ─── List Users ─────────────────────────────────────────────────────────────

export async function listUsers(query: ListUsersQuery) {
  const { page, limit, search, role, isActive } = query;

  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  if (role) {
    filter.role = role;
  }

  if (isActive) {
    filter.isActive = isActive === 'true';
  }

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
    throw ApiError.notFound('User not found');
  }
  return user;
}

// ─── Create User (Admin) ────────────────────────────────────────────────────

export async function createUser(input: CreateUserInput) {
  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict('A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await User.create({
    ...input,
    email: input.email.toLowerCase(),
    passwordHash,
    isActive: true,
  });

  await logUserEvent(AuditAction.USER_CREATED, user._id.toString(), undefined, undefined, {
    email: user.email,
    role: user.role,
  });

  return user;
}

// ─── Update User (Admin) ────────────────────────────────────────────────────

export async function updateUser(userId: string, input: UpdateUserInput) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Prevent deactivating the last super admin
  if (input.isActive === false && user.role === Role.SUPER_ADMIN) {
    const superAdminCount = await User.countDocuments({
      role: Role.SUPER_ADMIN,
      isActive: true,
    });
    if (superAdminCount <= 1) {
      throw ApiError.badRequest('Cannot deactivate the last active Super Admin');
    }
  }

  Object.assign(user, input);
  await user.save();

  await logUserEvent(AuditAction.USER_UPDATED, user._id.toString(), undefined, undefined, {
    changes: Object.keys(input),
  });

  return user;
}

// ─── Deactivate User ────────────────────────────────────────────────────────

export async function deactivateUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  if (user.role === Role.SUPER_ADMIN) {
    const superAdminCount = await User.countDocuments({
      role: Role.SUPER_ADMIN,
      isActive: true,
    });
    if (superAdminCount <= 1) {
      throw ApiError.badRequest('Cannot deactivate the last active Super Admin');
    }
  }

  user.isActive = false;
  await user.save();

  await logUserEvent(AuditAction.USER_DEACTIVATED, user._id.toString(), undefined, undefined);

  return user;
}

// ─── Create Invitation (Admin) ──────────────────────────────────────────────

export async function createInvitation(
  input: CreateInvitationInput,
  invitedByUserId: string
) {
  // Check if user already exists
  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict('A user with this email already exists');
  }

  // Check for pending invitation
  const existingInvitation = await Invitation.findOne({
    email: input.email.toLowerCase(),
    acceptedAt: { $exists: false },
  });
  if (existingInvitation) {
    throw ApiError.conflict('A pending invitation already exists for this email');
  }

  // Generate invitation token
  const rawToken = generateSecureToken();
  const hashedToken = hashToken(rawToken);

  const invitation = await Invitation.create({
    ...input,
    email: input.email.toLowerCase(),
    token: hashedToken,
    invitedBy: invitedByUserId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  // In production, send email with: ${env.APP_URL}/accept-invitation?token=${rawToken}
  if (env.NODE_ENV === 'development') {
    console.log(`[INVITATION] Token for ${input.email}: ${rawToken}`);
  }

  return invitation;
}

// ─── List Invitations ───────────────────────────────────────────────────────

export async function listInvitations(query: ListInvitationsQuery) {
  const { page, limit, status } = query;

  const filter: Record<string, unknown> = {};

  if (status === 'pending') {
    filter.acceptedAt = { $exists: false };
    filter.expiresAt = { $gt: new Date() };
  } else if (status === 'accepted') {
    filter.acceptedAt = { $exists: true };
  } else if (status === 'expired') {
    filter.acceptedAt = { $exists: false };
    filter.expiresAt = { $lte: new Date() };
  }

  const [invitations, total] = await Promise.all([
    Invitation.find(filter)
      .populate('invitedBy', 'name email')
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
    throw ApiError.notFound('Invitation not found');
  }

  if (invitation.acceptedAt) {
    throw ApiError.badRequest('Invitation has already been accepted');
  }

  // Generate new token
  const rawToken = generateSecureToken();
  const hashedToken = hashToken(rawToken);

  invitation.token = hashedToken;
  invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await invitation.save();

  if (env.NODE_ENV === 'development') {
    console.log(`[INVITATION RESENT] Token for ${invitation.email}: ${rawToken}`);
  }

  return invitation;
}

// ─── Revoke Invitation ──────────────────────────────────────────────────────

export async function revokeInvitation(invitationId: string) {
  const invitation = await Invitation.findById(invitationId);
  if (!invitation) {
    throw ApiError.notFound('Invitation not found');
  }

  if (invitation.acceptedAt) {
    throw ApiError.badRequest('Cannot revoke an accepted invitation');
  }

  await invitation.deleteOne();
  return { message: 'Invitation revoked' };
}
