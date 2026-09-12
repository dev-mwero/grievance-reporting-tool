import { Notification, type NotificationType } from '../models/notification.model';

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  grievanceId?: string;
  referenceCode?: string;
}

/**
 * Create a notification for a single recipient.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await Notification.create({
    recipientId: input.recipientId,
    type: input.type,
    title: input.title,
    message: input.message,
    grievanceId: input.grievanceId,
    referenceCode: input.referenceCode,
  });
}

/**
 * Create notifications for multiple recipients.
 */
export async function createNotifications(
  inputs: CreateNotificationInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  await Notification.insertMany(
    inputs.map((i) => ({
      recipientId: i.recipientId,
      type: i.type,
      title: i.title,
      message: i.message,
      grievanceId: i.grievanceId,
      referenceCode: i.referenceCode,
    }))
  );
}

/**
 * List notifications for a user, most recent first.
 */
export async function listNotifications(
  userId: string,
  page = 1,
  limit = 20,
  unreadOnly = false
) {
  const filter: Record<string, unknown> = { recipientId: userId };
  if (unreadOnly) filter.isRead = false;

  const [total, data] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get the unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ recipientId: userId, isRead: false });
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(userId: string, notificationId: string) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientId: userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) {
    return null;
  }
  return notification;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<void> {
  await Notification.updateMany(
    { recipientId: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
}
