import {
  Notification,
  type NotificationType,
} from "../models/notification.model";

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  grievanceId?: string;
  referenceCode?: string;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  await Notification.create({
    recipientId: input.recipientId,
    type: input.type,
    title: input.title,
    message: input.message,
    grievanceId: input.grievanceId,
    referenceCode: input.referenceCode,
  });
}

export async function createNotifications(
  inputs: CreateNotificationInput[],
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
    })),
  );
}

export async function listNotifications(
  userId: string,
  page = 1,
  limit = 20,
  unreadOnly = false,
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

export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ recipientId: userId, isRead: false });
}

export async function markAsRead(userId: string, notificationId: string) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientId: userId },
    { isRead: true, readAt: new Date() },
    { new: true },
  );
  return notification;
}

export async function markAllAsRead(userId: string): Promise<void> {
  await Notification.updateMany(
    { recipientId: userId, isRead: false },
    { isRead: true, readAt: new Date() },
  );
}
