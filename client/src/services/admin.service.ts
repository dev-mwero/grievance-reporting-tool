import { api } from '../lib/api';
import type { ApiResponse, PaginatedResponse } from 'shared';
import type { Role } from 'shared';

// ─── Users ──────────────────────────────────────────────────────────────────

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  title?: string;
  department?: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  role: Role;
  title?: string;
  department?: string;
  password: string;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  role?: Role;
  title?: string;
  department?: string;
  isActive?: boolean;
}

export async function listUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: string;
} = {}): Promise<PaginatedResponse<AdminUser>> {
  const { data } = await api.get<PaginatedResponse<AdminUser>>('/admin/users', { params });
  return data;
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  const { data } = await api.post<ApiResponse<AdminUser>>('/admin/users', input);
  return data.data!;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AdminUser> {
  const { data } = await api.patch<ApiResponse<AdminUser>>(`/admin/users/${id}`, input);
  return data.data!;
}

export async function deactivateUser(id: string): Promise<AdminUser> {
  const { data } = await api.post<ApiResponse<AdminUser>>(`/admin/users/${id}/deactivate`);
  return data.data!;
}

// ─── Invitations ────────────────────────────────────────────────────────────

export interface Invitation {
  _id: string;
  email: string;
  name: string;
  role: Role;
  title?: string;
  invitedBy?: { _id: string; name: string; email: string };
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface CreateInvitationInput {
  email: string;
  name: string;
  phone?: string;
  title?: string;
  role: Role;
}

export async function listInvitations(params: {
  page?: number;
  limit?: number;
  status?: string;
} = {}): Promise<PaginatedResponse<Invitation>> {
  const { data } = await api.get<PaginatedResponse<Invitation>>('/admin/users/invitations', {
    params,
  });
  return data;
}

export async function createInvitation(input: CreateInvitationInput): Promise<Invitation> {
  const { data } = await api.post<ApiResponse<Invitation>>('/admin/users/invitations', input);
  return data.data!;
}

export async function resendInvitation(id: string): Promise<Invitation> {
  const { data } = await api.post<ApiResponse<Invitation>>(`/admin/users/invitations/${id}/resend`);
  return data.data!;
}

export async function revokeInvitation(id: string): Promise<void> {
  await api.delete(`/admin/users/invitations/${id}`);
}

// ─── Categories ─────────────────────────────────────────────────────────────

export interface Category {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export async function listCategories(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PaginatedResponse<Category>> {
  const { data } = await api.get<PaginatedResponse<Category>>('/admin/categories', { params });
  return data;
}

export async function createCategory(input: {
  name: string;
  description?: string;
}): Promise<Category> {
  const { data } = await api.post<ApiResponse<Category>>('/admin/categories', input);
  return data.data!;
}

export async function updateCategory(
  id: string,
  input: { name?: string; description?: string; isActive?: boolean }
): Promise<Category> {
  const { data } = await api.patch<ApiResponse<Category>>(`/admin/categories/${id}`, input);
  return data.data!;
}

export async function deactivateCategory(id: string): Promise<Category> {
  const { data } = await api.post<ApiResponse<Category>>(`/admin/categories/${id}/deactivate`);
  return data.data!;
}

// ─── Sub-Counties ───────────────────────────────────────────────────────────

export interface SubCounty {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export async function listSubCounties(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PaginatedResponse<SubCounty>> {
  const { data } = await api.get<PaginatedResponse<SubCounty>>('/admin/sub-counties', { params });
  return data;
}

export async function createSubCounty(input: {
  name: string;
  code: string;
}): Promise<SubCounty> {
  const { data } = await api.post<ApiResponse<SubCounty>>('/admin/sub-counties', input);
  return data.data!;
}

export async function updateSubCounty(
  id: string,
  input: { name?: string; code?: string; isActive?: boolean }
): Promise<SubCounty> {
  const { data } = await api.patch<ApiResponse<SubCounty>>(`/admin/sub-counties/${id}`, input);
  return data.data!;
}

export async function deactivateSubCounty(id: string): Promise<SubCounty> {
  const { data } = await api.post<ApiResponse<SubCounty>>(`/admin/sub-counties/${id}/deactivate`);
  return data.data!;
}

// ─── Wards ──────────────────────────────────────────────────────────────────

export interface Ward {
  _id: string;
  name: string;
  code: string;
  subCountyId: string | { _id: string; name: string; code: string };
  isActive: boolean;
  createdAt: string;
}

export async function listWards(params: {
  page?: number;
  limit?: number;
  search?: string;
  subCountyId?: string;
} = {}): Promise<PaginatedResponse<Ward>> {
  const { data } = await api.get<PaginatedResponse<Ward>>('/admin/wards', { params });
  return data;
}

export async function createWard(input: {
  name: string;
  code: string;
  subCountyId: string;
}): Promise<Ward> {
  const { data } = await api.post<ApiResponse<Ward>>('/admin/wards', input);
  return data.data!;
}

export async function updateWard(
  id: string,
  input: { name?: string; code?: string; subCountyId?: string; isActive?: boolean }
): Promise<Ward> {
  const { data } = await api.patch<ApiResponse<Ward>>(`/admin/wards/${id}`, input);
  return data.data!;
}

export async function deactivateWard(id: string): Promise<Ward> {
  const { data } = await api.post<ApiResponse<Ward>>(`/admin/wards/${id}/deactivate`);
  return data.data!;
}
