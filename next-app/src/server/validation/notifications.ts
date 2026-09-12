import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.enum(["true", "false"]).optional(),
});

export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;

export const notificationParamsSchema = z.object({
  id: z.string().min(1, "Notification ID is required"),
});

export type NotificationParams = z.infer<typeof notificationParamsSchema>;
