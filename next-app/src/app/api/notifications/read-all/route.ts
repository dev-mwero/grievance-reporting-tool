import { requireAuth } from "@/server/auth";
import { handle, okMessage } from "@/server/http";
import { markAllAsRead } from "@/server/services/notification.service";

export async function POST() {
  return handle(async () => {
    const { userId } = await requireAuth();
    await markAllAsRead(userId);
    return okMessage("All notifications marked as read");
  });
}
