import type { NextRequest } from "next/server";
import { requireAuth, setAccessCookie } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { switchRole } from "@/server/services/auth.service";
import { switchRoleSchema } from "@/server/validation/auth";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { userId } = await requireAuth();
    const body = validate(switchRoleSchema, await req.json().catch(() => ({})));
    const { user, accessToken } = await switchRole(userId, body.role);
    await setAccessCookie(accessToken);
    return ok({ user });
  });
}
