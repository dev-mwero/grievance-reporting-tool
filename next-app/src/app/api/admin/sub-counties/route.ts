import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok, paginated, readQuery, validate } from "@/server/http";
import {
  createSubCounty,
  listSubCounties,
} from "@/server/services/locations.service";
import {
  createSubCountySchema,
  listSubCountiesQuerySchema,
} from "@/server/validation/locations";
import { Role } from "@/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const query = validate(listSubCountiesQuerySchema, readQuery(req));
    const { subCounties, pagination } = await listSubCounties(query);
    return paginated(subCounties, pagination, "subCounties");
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const body = validate(
      createSubCountySchema,
      await req.json().catch(() => ({})),
    );
    const subCounty = await createSubCounty(body);
    return ok(subCounty, 201);
  });
}
