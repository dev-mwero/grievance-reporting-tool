export enum GrievanceStatus {
  SUBMITTED = "SUBMITTED",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  UNDER_REVIEW = "UNDER_REVIEW",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
  REJECTED = "REJECTED",
}

export const STATUS_TRANSITIONS: Record<GrievanceStatus, GrievanceStatus[]> = {
  [GrievanceStatus.SUBMITTED]: [
    GrievanceStatus.ACKNOWLEDGED,
    GrievanceStatus.REJECTED,
  ],
  [GrievanceStatus.ACKNOWLEDGED]: [
    GrievanceStatus.UNDER_REVIEW,
    GrievanceStatus.REJECTED,
  ],
  [GrievanceStatus.UNDER_REVIEW]: [
    GrievanceStatus.ASSIGNED,
    GrievanceStatus.REJECTED,
    GrievanceStatus.RESOLVED,
  ],
  [GrievanceStatus.ASSIGNED]: [
    GrievanceStatus.IN_PROGRESS,
    GrievanceStatus.REJECTED,
  ],
  [GrievanceStatus.IN_PROGRESS]: [
    GrievanceStatus.RESOLVED,
    GrievanceStatus.REJECTED,
  ],
  [GrievanceStatus.RESOLVED]: [
    GrievanceStatus.CLOSED,
    GrievanceStatus.IN_PROGRESS,
  ],
  [GrievanceStatus.CLOSED]: [],
  [GrievanceStatus.REJECTED]: [],
};

export function canTransition(
  from: GrievanceStatus,
  to: GrievanceStatus,
): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  STAFF = "STAFF",
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 3,
  [Role.ADMIN]: 2,
  [Role.STAFF]: 1,
};

export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T, K extends string = "results"> {
  success: boolean;
  message?: string;
  data: { [P in K]: T[] } & { pagination: PaginationMeta };
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  title?: string;
}
