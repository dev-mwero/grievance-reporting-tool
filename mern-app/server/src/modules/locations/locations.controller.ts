import type { Request, Response } from 'express';
import * as locationsService from './locations.service';
import { getParam } from '../../utils/params';
import type {
  ListSubCountiesQuery,
  CreateSubCountyInput,
  UpdateSubCountyInput,
  ListWardsQuery,
  CreateWardInput,
  UpdateWardInput,
} from './locations.validation';

// ─── Sub-Counties ───────────────────────────────────────────────────────────

export async function listSubCounties(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as ListSubCountiesQuery;
  const result = await locationsService.listSubCounties(query);

  res.json({
    success: true,
    data: result.subCounties,
    pagination: result.pagination,
  });
}

export async function getSubCounty(req: Request, res: Response): Promise<void> {
  const subCounty = await locationsService.getSubCountyById(getParam(req, 'id'));

  res.json({
    success: true,
    data: subCounty,
  });
}

export async function createSubCounty(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as CreateSubCountyInput;
  const subCounty = await locationsService.createSubCounty(input);

  res.status(201).json({
    success: true,
    message: 'Sub-County created successfully',
    data: subCounty,
  });
}

export async function updateSubCounty(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as UpdateSubCountyInput;
  const subCounty = await locationsService.updateSubCounty(getParam(req, 'id'), input);

  res.json({
    success: true,
    message: 'Sub-County updated successfully',
    data: subCounty,
  });
}

export async function deactivateSubCounty(req: Request, res: Response): Promise<void> {
  const subCounty = await locationsService.deactivateSubCounty(getParam(req, 'id'));

  res.json({
    success: true,
    message: 'Sub-County deactivated',
    data: subCounty,
  });
}

// ─── Wards ──────────────────────────────────────────────────────────────────

export async function listWards(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as ListWardsQuery;
  const result = await locationsService.listWards(query);

  res.json({
    success: true,
    data: result.wards,
    pagination: result.pagination,
  });
}

export async function getWard(req: Request, res: Response): Promise<void> {
  const ward = await locationsService.getWardById(getParam(req, 'id'));

  res.json({
    success: true,
    data: ward,
  });
}

export async function createWard(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as CreateWardInput;
  const ward = await locationsService.createWard(input);

  res.status(201).json({
    success: true,
    message: 'Ward created successfully',
    data: ward,
  });
}

export async function updateWard(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as UpdateWardInput;
  const ward = await locationsService.updateWard(getParam(req, 'id'), input);

  res.json({
    success: true,
    message: 'Ward updated successfully',
    data: ward,
  });
}

export async function deactivateWard(req: Request, res: Response): Promise<void> {
  const ward = await locationsService.deactivateWard(getParam(req, 'id'));

  res.json({
    success: true,
    message: 'Ward deactivated',
    data: ward,
  });
}
