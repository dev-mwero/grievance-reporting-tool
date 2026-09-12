import type { NextRequest } from "next/server";
import { ApiError } from "@/server/api-error";
import { requireAuth } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { markAsRead } from "@/server/services/notification.service";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { userId } = await requireAuth();
    const { id } = await params;
    const notification = await markAsRead(userId, id);
    if (!notification) {
      throw ApiError.notFound("Notification not found");
    }
    return ok(notification);
  });
}
