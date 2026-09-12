import { handle, ok } from "@/server/http";
import { getActiveCategories } from "@/server/services/public.service";

export async function GET() {
  return handle(async () => {
    const categories = await getActiveCategories();
    return ok(categories);
  });
}
