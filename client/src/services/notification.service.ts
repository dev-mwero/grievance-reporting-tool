import { api } from '../lib/api';
import type { ApiResponse, PaginatedResponse } from 'shared';

export interface Notification {
  _id: string;
  type: 'GRIEVANCE_ASSIGNED' | 'GRIEVANCE_STATUS_CHANGED' | 'GRIEVANCE_UPDATE' | 'SYSTEM';
  title: string;
  message: string;
  grievanceId?: string;
  referenceCode?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export async function listNotifications(
  params: ListNotificationsParams = {}
): Promise<PaginatedResponse<Notification>> {
  const { data } = await api.get<PaginatedResponse<Notification>>('/notifications', {
    params: {
      page: params.page,
      limit: params.limit,
      unreadOnly: params.unreadOnly ? 'true' : undefined,
    },
  });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
  return data.data!.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}
