import { requireAuth } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { getUnreadCount } from "@/server/services/notification.service";

export async function GET() {
  return handle(async () => {
    const { userId } = await requireAuth();
    const count = await getUnreadCount(userId);
    return ok({ count });
  });
}
