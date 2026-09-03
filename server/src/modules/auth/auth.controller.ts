import type { Request, Response } from 'express';
import * as authService from './auth.service';
import type {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  AcceptInvitationInput,
} from './auth.validation';

export async function login(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as LoginInput;
  const result = await authService.login(input);

  res.json({
    success: true,
    message: 'Login successful',
    data: result,
  });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.validated as unknown as { refreshToken: string };
  const result = await authService.refreshAccessToken(refreshToken);

  res.json({
    success: true,
    message: 'Token refreshed',
    data: result,
  });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as ForgotPasswordInput;
  const result = await authService.forgotPassword(input);

  res.json({
    success: true,
    message: result.message,
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as ResetPasswordInput;
  const result = await authService.resetPassword(input);

  res.json({
    success: true,
    message: result.message,
  });
}

export async function acceptInvitation(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as AcceptInvitationInput;
  const result = await authService.acceptInvitation(input);

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: result,
  });
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const user = await authService.getProfile(req.user!.userId);

  res.json({
    success: true,
    data: user,
  });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.validated as unknown as {
    currentPassword: string;
    newPassword: string;
  };
  const result = await authService.changePassword(
    req.user!.userId,
    currentPassword,
    newPassword
  );

  res.json({
    success: true,
    message: result.message,
  });
}
