import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Role } from 'shared';
import { User, type IUser } from '../../models/user.model';
import { Invitation, type IInvitation } from '../../models/invitation.model';
import { PasswordResetToken } from '../../models/password-reset-token.model';
import {
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,
  hashToken,
  verifyRefreshToken,
} from '../../utils/token';
import { ApiError } from '../../utils/api-error';
import { env } from '../../config/env';
import type {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  AcceptInvitationInput,
  CreateInvitationInput,
} from './auth.validation';

const SALT_ROUNDS = 12;

// ─── Login ──────────────────────────────────────────────────────────────────

export async function login(input: LoginInput) {
  // Find user with password hash
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    '+passwordHash'
  );

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account is deactivated. Contact an administrator.');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Update last login
  user.lastLoginAt = new Date();
  await user.save();

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    tokenVersion: 0,
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      title: user.title,
    },
    accessToken,
    refreshToken,
  };
}

// ─── Refresh Token ──────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  const user = await User.findById(payload.userId);
  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account is deactivated');
  }

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { accessToken };
}

// ─── Forgot Password ────────────────────────────────────────────────────────

export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await User.findOne({ email: input.email.toLowerCase() });
  if (!user) {
    // Don't reveal whether the email exists
    return { message: 'If the email exists, a reset link has been sent' };
  }

  // Invalidate any existing reset tokens for this user
  await PasswordResetToken.deleteMany({ userId: user._id });

  // Generate reset token
  const rawToken = generateSecureToken();
  const hashedToken = hashToken(rawToken);

  await PasswordResetToken.create({
    userId: user._id,
    token: hashedToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  // In production, send email with: ${env.APP_URL}/reset-password?token=${rawToken}
  // For now, log the token in development
  if (env.NODE_ENV === 'development') {
    console.log(`[PASSWORD RESET] Token for ${user.email}: ${rawToken}`);
  }

  return { message: 'If the email exists, a reset link has been sent' };
}

// ─── Reset Password ─────────────────────────────────────────────────────────

export async function resetPassword(input: ResetPasswordInput) {
  const hashedToken = hashToken(input.token);

  const resetToken = await PasswordResetToken.findOne({
    token: hashedToken,
    usedAt: { $exists: false },
  }).select('+token');

  if (!resetToken) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  if (resetToken.expiresAt < new Date()) {
    throw ApiError.badRequest('Reset token has expired');
  }

  // Update password
  const user = await User.findById(resetToken.userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  user.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  await user.save();

  // Mark token as used
  resetToken.usedAt = new Date();
  await resetToken.save();

  return { message: 'Password reset successful' };
}

// ─── Accept Invitation ──────────────────────────────────────────────────────

export async function acceptInvitation(input: AcceptInvitationInput) {
  const hashedToken = hashToken(input.token);

  const invitation = await Invitation.findOne({
    token: hashedToken,
    acceptedAt: { $exists: false },
  }).select('+token');

  if (!invitation) {
    throw ApiError.badRequest('Invalid or expired invitation');
  }

  if (invitation.expiresAt < new Date()) {
    throw ApiError.badRequest('Invitation has expired');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: invitation.email });
  if (existingUser) {
    throw ApiError.conflict('An account with this email already exists');
  }

  // Create user from invitation
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await User.create({
    name: invitation.name,
    email: invitation.email,
    phone: invitation.phone,
    title: invitation.title,
    role: invitation.role,
    passwordHash,
    isActive: true,
  });

  // Mark invitation as accepted
  invitation.acceptedAt = new Date();
  await invitation.save();

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    tokenVersion: 0,
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
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
    throw ApiError.notFound('User not found');
  }
  return user;
}

// ─── Change Password ────────────────────────────────────────────────────────

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  return { message: 'Password changed successfully' };
}
