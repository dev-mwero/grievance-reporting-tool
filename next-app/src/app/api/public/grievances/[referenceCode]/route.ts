import type { NextRequest } from "next/server";
import { handle, ok, validate } from "@/server/http";
import { trackByReferenceCode } from "@/server/services/public.service";
import { trackGrievanceParamsSchema } from "@/server/validation/public";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ referenceCode: string }> },
) {
  return handle(async () => {
    const { referenceCode } = await params;
    validate(trackGrievanceParamsSchema, { referenceCode });
    const result = await trackByReferenceCode(referenceCode);
    return ok(result);
  });
}
