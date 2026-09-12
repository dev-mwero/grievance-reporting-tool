import { requireAuth } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { getDashboardStats } from "@/server/services/grievances.service";

export async function GET() {
  return handle(async () => {
    const { userId } = await requireAuth();
    const result = await getDashboardStats(userId);
    return ok(result);
  });
}
