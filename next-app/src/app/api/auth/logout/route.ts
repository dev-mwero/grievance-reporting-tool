import { clearAuthCookies } from "@/server/auth";
import { handle, okMessage } from "@/server/http";

export async function POST() {
  return handle(async () => {
    await clearAuthCookies();
    return okMessage("Signed out");
  });
}
