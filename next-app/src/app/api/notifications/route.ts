import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth";
import { handle, paginated, readQuery, validate } from "@/server/http";
import { listNotifications } from "@/server/services/notification.service";
import { listNotificationsQuerySchema } from "@/server/validation/notifications";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const { userId } = await requireAuth();
    const query = validate(listNotificationsQuerySchema, readQuery(req));
    const { data, pagination } = await listNotifications(
      userId,
      query.page,
      query.limit,
      query.unreadOnly === "true",
    );
    return paginated(data, pagination, "notifications");
  });
}
