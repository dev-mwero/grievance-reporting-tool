import { cookies } from "next/headers";

import { ApiError } from "@/server/api-error";
import { REFRESH_COOKIE, setAccessCookie } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { refreshAccessToken } from "@/server/services/auth.service";

export async function POST() {
  return handle(async () => {
    const store = await cookies();
    const refreshToken = store.get(REFRESH_COOKIE)?.value;
    if (!refreshToken) {
      throw ApiError.unauthorized("Not authenticated");
    }
    const { accessToken } = await refreshAccessToken(refreshToken);
    await setAccessCookie(accessToken);
    return ok({ accessToken });
  });
}
