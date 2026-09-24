import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok, paginated, readQuery, validate } from "@/server/http";
import { createUser, listUsers } from "@/server/services/users.service";
import {
  createUserSchema,
  listUsersQuerySchema,
} from "@/server/validation/users";
import { Role } from "@/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const viewer = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const query = validate(listUsersQuerySchema, readQuery(req));
    const { users, pagination } = await listUsers(query, viewer.role as Role);
    return paginated(users, pagination, "users");
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const viewer = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const body = validate(createUserSchema, await req.json().catch(() => ({})));
    const user = await createUser(body, viewer.role as Role);
    return ok(user, 201);
  });
}
