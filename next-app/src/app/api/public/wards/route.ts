import type { NextRequest } from "next/server";
import { handle, ok, readQuery, validate } from "@/server/http";
import { getActiveWardsBySubCounty } from "@/server/services/public.service";
import { listWardsBySubCountyQuerySchema } from "@/server/validation/public";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const query = validate(listWardsBySubCountyQuerySchema, readQuery(req));
    const wards = await getActiveWardsBySubCounty(query.subCountyId);
    return ok(wards);
  });
}
