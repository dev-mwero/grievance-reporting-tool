import { handle, ok } from "@/server/http";
import { getPublicStats } from "@/server/services/public.service";

export async function GET() {
  return handle(async () => {
    const stats = await getPublicStats();
    return ok(stats);
  });
}
