import { api } from '../lib/api';
import type { ApiResponse } from 'shared';

export interface SubCounty {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface Ward {
  _id: string;
  name: string;
  code: string;
  subCountyId: string;
  isActive: boolean;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface SubmitGrievanceInput {
  subCountyId: string;
  wardId: string;
  categoryId: string;
  description: string;
}

export interface SubmittedGrievance {
  referenceCode: string;
  submittedAt: string;
  status: string;
  subCountyName: string;
  wardName: string;
  categoryName: string;
}

export interface TrackedGrievance {
  referenceCode: string;
  status: string;
  subCountyName: string;
  wardName: string;
  categoryName: string;
  description: string;
  submittedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  updates?: Array<{
    _id: string;
    content: string;
    authorName: string;
    createdAt: string;
  }>;
}

export async function getSubCounties(): Promise<SubCounty[]> {
  const { data } = await api.get<ApiResponse<SubCounty[]>>('/public/sub-counties');
  return data.data ?? [];
}

export async function getWards(subCountyId: string): Promise<Ward[]> {
  const { data } = await api.get<ApiResponse<Ward[]>>('/public/wards', {
    params: { subCountyId },
  });
  return data.data ?? [];
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get<ApiResponse<Category[]>>('/public/categories');
  return data.data ?? [];
}

export async function submitGrievance(
  input: SubmitGrievanceInput
): Promise<SubmittedGrievance> {
  const { data } = await api.post<ApiResponse<SubmittedGrievance>>('/public/grievances', input);
  return data.data!;
}

export async function trackGrievance(referenceCode: string): Promise<TrackedGrievance> {
  const { data } = await api.get<ApiResponse<TrackedGrievance>>(
    `/public/grievances/${referenceCode}`
  );
  return data.data!;
}
