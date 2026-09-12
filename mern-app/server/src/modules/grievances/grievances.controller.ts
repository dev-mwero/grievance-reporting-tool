import type { Request, Response } from 'express';
import * as grievancesService from './grievances.service';
import { getParam } from '../../utils/params';
import type {
  ListGrievancesQuery,
  UpdateStatusInput,
  AssignGrievanceInput,
  AddUpdateInput,
} from './grievances.validation';

// ─── List Grievances ────────────────────────────────────────────────────────

export async function listGrievances(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as ListGrievancesQuery;
  const result = await grievancesService.listGrievances(query);

  res.json({
    success: true,
    data: result.grievances,
    pagination: result.pagination,
  });
}

// ─── Get Grievance Detail ───────────────────────────────────────────────────

export async function getGrievance(req: Request, res: Response): Promise<void> {
  const result = await grievancesService.getGrievanceById(getParam(req, 'id'));

  res.json({
    success: true,
    data: result,
  });
}

// ─── Update Status ──────────────────────────────────────────────────────────

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as UpdateStatusInput;
  const grievance = await grievancesService.updateStatus(
    getParam(req, 'id'),
    input,
    req.user!.userId,
    req.user!.email
  );

  res.json({
    success: true,
    message: `Grievance status updated to ${input.status}`,
    data: grievance,
  });
}

// ─── Assign Grievance ───────────────────────────────────────────────────────

export async function assignGrievance(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as AssignGrievanceInput;
  const grievance = await grievancesService.assignGrievance(
    getParam(req, 'id'),
    input,
    req.user!.userId,
    req.user!.email
  );

  res.json({
    success: true,
    message: 'Grievance assigned successfully',
    data: grievance,
  });
}

// ─── Add Update ─────────────────────────────────────────────────────────────

export async function addUpdate(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as AddUpdateInput;
  const update = await grievancesService.addUpdate(
    getParam(req, 'id'),
    input,
    req.user!.userId,
    req.user!.email
  );

  res.status(201).json({
    success: true,
    message: 'Update added successfully',
    data: update,
  });
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const stats = await grievancesService.getDashboardStats(req.user!.userId);

  res.json({
    success: true,
    data: stats,
  });
}