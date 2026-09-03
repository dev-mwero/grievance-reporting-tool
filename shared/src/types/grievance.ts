export enum GrievanceStatus {
  SUBMITTED = 'SUBMITTED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED',
}

/**
 * Valid status transitions. A grievance can only move
 * from a given status to one of the listed targets.
 */
export const STATUS_TRANSITIONS: Record<GrievanceStatus, GrievanceStatus[]> = {
  [GrievanceStatus.SUBMITTED]: [GrievanceStatus.ACKNOWLEDGED, GrievanceStatus.REJECTED],
  [GrievanceStatus.ACKNOWLEDGED]: [GrievanceStatus.UNDER_REVIEW, GrievanceStatus.REJECTED],
  [GrievanceStatus.UNDER_REVIEW]: [
    GrievanceStatus.ASSIGNED,
    GrievanceStatus.REJECTED,
    GrievanceStatus.RESOLVED,
  ],
  [GrievanceStatus.ASSIGNED]: [GrievanceStatus.IN_PROGRESS, GrievanceStatus.REJECTED],
  [GrievanceStatus.IN_PROGRESS]: [GrievanceStatus.RESOLVED, GrievanceStatus.REJECTED],
  [GrievanceStatus.RESOLVED]: [GrievanceStatus.CLOSED, GrievanceStatus.IN_PROGRESS], // reopen
  [GrievanceStatus.CLOSED]: [], // terminal
  [GrievanceStatus.REJECTED]: [], // terminal
};

export function canTransition(from: GrievanceStatus, to: GrievanceStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}
