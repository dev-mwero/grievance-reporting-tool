import { api } from '../lib/api';
import type { ApiResponse } from 'shared';

// ─── Forgot Password ────────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<string> {
  const { data } = await api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', {
    email,
  });
  return data.message ?? 'If the email exists, a reset link has been sent';
}

// ─── Reset Password ─────────────────────────────────────────────────────────

export async function resetPassword(
  token: string,
  password: string,
  confirmPassword: string
): Promise<string> {
  const { data } = await api.post<ApiResponse<{ message: string }>>('/auth/reset-password', {
    token,
    password,
    confirmPassword,
  });
  return data.message ?? 'Password reset successful';
}

// ─── Change Password ────────────────────────────────────────────────────────

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<string> {
  const { data } = await api.post<ApiResponse<{ message: string }>>('/auth/change-password', {
    currentPassword,
    newPassword,
    confirmPassword,
  });
  return data.message ?? 'Password changed successfully';
}