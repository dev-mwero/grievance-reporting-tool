import type { Request, Response } from 'express';
import * as usersService from './users.service';
import { getParam } from '../../utils/params';
import type {
  ListUsersQuery,
  CreateUserInput,
  UpdateUserInput,
  CreateInvitationInput,
  ListInvitationsQuery,
} from './users.validation';

// ─── Users ──────────────────────────────────────────────────────────────────

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as ListUsersQuery;
  const result = await usersService.listUsers(query);

  res.json({
    success: true,
    data: result.users,
    pagination: result.pagination,
  });
}

export async function getUser(req: Request, res: Response): Promise<void> {
  const user = await usersService.getUserById(getParam(req, 'id'));

  res.json({
    success: true,
    data: user,
  });
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as CreateUserInput;
  const user = await usersService.createUser(input);

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: user,
  });
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as UpdateUserInput;
  const user = await usersService.updateUser(getParam(req, 'id'), input);

  res.json({
    success: true,
    message: 'User updated successfully',
    data: user,
  });
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  const user = await usersService.deactivateUser(getParam(req, 'id'));

  res.json({
    success: true,
    message: 'User deactivated',
    data: user,
  });
}

// ─── Invitations ────────────────────────────────────────────────────────────

export async function createInvitation(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as CreateInvitationInput;
  const invitation = await usersService.createInvitation(input, req.user!.userId);

  res.status(201).json({
    success: true,
    message: 'Invitation created successfully',
    data: invitation,
  });
}

export async function listInvitations(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as ListInvitationsQuery;
  const result = await usersService.listInvitations(query);

  res.json({
    success: true,
    data: result.invitations,
    pagination: result.pagination,
  });
}

export async function resendInvitation(req: Request, res: Response): Promise<void> {
  const invitation = await usersService.resendInvitation(getParam(req, 'id'));

  res.json({
    success: true,
    message: 'Invitation resent',
    data: invitation,
  });
}

export async function revokeInvitation(req: Request, res: Response): Promise<void> {
  const result = await usersService.revokeInvitation(getParam(req, 'id'));

  res.json({
    success: true,
    message: result.message,
  });
}
