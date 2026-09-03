import type { Request, Response } from 'express';
import * as publicService from './public.service';
import type { SubmitGrievanceInput, ListWardsBySubCountyQuery, TrackGrievanceParams } from './public.validation';

// ─── Lookup Data ────────────────────────────────────────────────────────────

export async function listSubCounties(_req: Request, res: Response): Promise<void> {
  const subCounties = await publicService.getActiveSubCounties();

  res.json({
    success: true,
    data: subCounties,
  });
}

export async function listWardsBySubCounty(req: Request, res: Response): Promise<void> {
  const { subCountyId } = req.validated as unknown as ListWardsBySubCountyQuery;
  const wards = await publicService.getActiveWardsBySubCounty(subCountyId);

  res.json({
    success: true,
    data: wards,
  });
}

export async function listCategories(_req: Request, res: Response): Promise<void> {
  const categories = await publicService.getActiveCategories();

  res.json({
    success: true,
    data: categories,
  });
}

// ─── Submit Grievance ───────────────────────────────────────────────────────

export async function submitGrievance(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as SubmitGrievanceInput;
  const result = await publicService.submitGrievance(input);

  res.status(201).json({
    success: true,
    message: 'Grievance submitted successfully',
    data: result,
  });
}

// ─── Track Grievance ────────────────────────────────────────────────────────

export async function trackGrievance(req: Request, res: Response): Promise<void> {
  const { referenceCode } = req.validated as unknown as TrackGrievanceParams;
  const grievance = await publicService.trackByReferenceCode(referenceCode);

  res.json({
    success: true,
    data: grievance,
  });
}
