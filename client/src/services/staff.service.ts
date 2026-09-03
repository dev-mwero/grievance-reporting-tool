import { api } from '../lib/api';
import type { ApiResponse, PaginatedResponse } from 'shared';

export interface GrievanceListItem {
  _id: string;
  referenceCode: string;
  subCountyName: string;
  wardName: string;
  categoryName: string;
  description: string;
  status: string;
  submittedAt: string;
  createdAt: string;
  categoryId?: { _id: string; name: string };
  primaryAssigneeId?: { _id: string; name: string; email: string } | string;
}

export interface GrievanceDetail {
  grievance: {
    _id: string;
    referenceCode: string;
    subCountyName: string;
    wardName: string;
    categoryName: string;
    description: string;
    status: string;
    submittedAt: string;
    acknowledgedAt?: string;
    resolvedAt?: string;
    closedAt?: string;
    primaryAssigneeId?: { _id: string; name: string; email: string; title?: string };
  };
  updates: Array<{
    _id: string;
    type: 'PUBLIC_UPDATE' | 'INTERNAL_NOTE';
    content: string;
    authorName: string;
    createdAt: string;
  }>;
  assignments: Array<{
    _id: string;
    assigneeName: string;
    isPrimary: boolean;
    assignedAt: string;
  }>;
}

export interface DashboardStats {
  myAssigned: number;
  totalOpen: number;
  recentActivity: Array<{
    _id: string;
    type: string;
    content: string;
    createdAt: string;
    grievanceId?: { referenceCode: string; status: string };
  }>;
}

export interface ListGrievancesParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<ApiResponse<DashboardStats>>('/grievances/dashboard');
  return data.data!;
}

export async function listGrievances(
  params: ListGrievancesParams = {}
): Promise<PaginatedResponse<GrievanceListItem>> {
  const { data } = await api.get<PaginatedResponse<GrievanceListItem>>('/grievances', {
    params,
  });
  return data;
}

export async function getGrievance(id: string): Promise<GrievanceDetail> {
  const { data } = await api.get<ApiResponse<GrievanceDetail>>(`/grievances/${id}`);
  return data.data!;
}

export async function updateGrievanceStatus(
  id: string,
  status: string,
  note?: string
): Promise<void> {
  await api.patch(`/grievances/${id}/status`, { status, note });
}

export async function addGrievanceUpdate(
  id: string,
  type: 'PUBLIC_UPDATE' | 'INTERNAL_NOTE',
  content: string
): Promise<void> {
  await api.post(`/grievances/${id}/updates`, { type, content });
}
