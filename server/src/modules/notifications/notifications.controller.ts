import type { Request, Response } from 'express';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../../services/notification.service';
import { getParam } from '../../utils/params';
import type { ListNotificationsQuery } from './notifications.validation';

// GET /api/notifications
export async function list(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as ListNotificationsQuery;
  const result = await listNotifications(
    req.user!.userId,
    query.page,
    query.limit,
    query.unreadOnly === 'true'
  );

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
}

// GET /api/notifications/unread-count
export async function unreadCount(req: Request, res: Response): Promise<void> {
  const count = await getUnreadCount(req.user!.userId);
  res.json({
    success: true,
    data: { count },
  });
}

// PATCH /api/notifications/:id/read
export async function markRead(req: Request, res: Response): Promise<void> {
  const notification = await markAsRead(req.user!.userId, getParam(req, 'id'));
  if (!notification) {
    res.status(404).json({ success: false, message: 'Notification not found' });
    return;
  }
  res.json({
    success: true,
    data: notification,
  });
}

// POST /api/notifications/read-all
export async function readAll(req: Request, res: Response): Promise<void> {
  await markAllAsRead(req.user!.userId);
  res.json({
    success: true,
    message: 'All notifications marked as read',
  });
}
