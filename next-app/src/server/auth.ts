import { cookies } from "next/headers";
import { type AuthUser, Role } from "@/types";
import { ApiError } from "./api-error";
import { connectToDatabase } from "./db";
import { env } from "./env";
import { User } from "./models/user.model";
import {
  type AccessTokenPayload,
  durationToSeconds,
  verifyAccessToken,
} from "./token";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const ACCESS_MAX_AGE = durationToSeconds(env.JWT_ACCESS_EXPIRY, 900);
const REFRESH_MAX_AGE = durationToSeconds(env.JWT_REFRESH_EXPIRY, 604800);

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
};

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    ...cookieBase,
    maxAge: ACCESS_MAX_AGE,
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    ...cookieBase,
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function setAccessCookie(accessToken: string) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    ...cookieBase,
    maxAge: ACCESS_MAX_AGE,
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/**
 * Reject a request from an account that must no longer act.
 *
 * A verified JWT alone is not sufficient: without this check a soft-deleted
 * account would keep every permission it had until its access token expired,
 * and a permanently purged account would keep working for the remainder of
 * the token's lifetime. Cost is one indexed projection off the `_id` index.
 */
async function assertAccountUsable(userId: string): Promise<void> {
  await connectToDatabase();
  const account = await User.findById(userId)
    .select("isActive deletedAt")
    .lean();

  if (!account) {
    throw ApiError.unauthorized("Account no longer exists");
  }
  if (account.deletedAt) {
    throw ApiError.forbidden("This account has been deleted");
  }
  if (account.isActive === false) {
    throw ApiError.forbidden("Account is deactivated");
  }
}

/**
 * Returns the access token payload guarded by JWT verification alone. Used by
 * API Route Handlers where a verified, non-expired token is sufficient.
 */
export async function requireAuth(): Promise<AccessTokenPayload> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) throw ApiError.unauthorized("Not authenticated");
  try {
    const payload = verifyAccessToken(token);
    await assertAccountUsable(payload.userId);
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized("Session expired, please sign in again");
  }
}

export async function requireRole(
  ...roles: AccessTokenPayload["role"][]
): Promise<AccessTokenPayload> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw ApiError.forbidden(
      "You do not have permission to perform this action",
    );
  }
  return user;
}

/**
 * Guard for destructive, irreversible operations — permanently deleting a
 * record. Restricted to system admins; ordinary admins get the soft delete
 * path instead. The role is read from the token claim, which means a system
 * admin previewing a lower role is correctly denied while previewing.
 */
export async function requireSuperAdmin(): Promise<AccessTokenPayload> {
  const user = await requireAuth();
  if (user.role !== Role.SUPER_ADMIN) {
    throw ApiError.forbidden(
      "Only a system admin can permanently delete records",
    );
  }
  return user;
}

/** Resolve a display name for the current authenticated user (audit logging). */
export async function getActorName(
  payload: AccessTokenPayload,
): Promise<string> {
  try {
    await connectToDatabase();
    const user = await User.findById(payload.userId).select("name").lean();
    return user?.name || payload.email;
  } catch {
    return payload.email;
  }
}

/**
 * Server Component session accessor. Reads the access token cookie and enriches
 * it with live profile data (name, title, active status) from the database.
 * Returns null for anonymous visitors and for sessions whose account was
 * deactivated.
 */
export async function getSession(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }

  try {
    await connectToDatabase();
    const user = await User.findById(payload.userId)
      .select("name email role title isActive previewRole deletedAt")
      .lean();
    if (!user || user.isActive === false || user.deletedAt) return null;
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: (user.previewRole ?? user.role) as Role,
      previewRole: user.previewRole ? (user.previewRole as Role) : undefined,
      title: user.title,
    };
  } catch {
    return {
      id: payload.userId,
      name: payload.email,
      email: payload.email,
      role: payload.role as Role,
    };
  }
}
