import { handle, ok } from "@/server/http";
import { getActiveSubCounties } from "@/server/services/public.service";

export async function GET() {
  return handle(async () => {
    const subCounties = await getActiveSubCounties();
    return ok(subCounties);
  });
}
