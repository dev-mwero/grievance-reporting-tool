import type { NextRequest } from "next/server";
import { created, handle, validate } from "@/server/http";
import { checkRateLimit } from "@/server/rate-limit";
import { submitGrievance } from "@/server/services/public.service";
import { submitGrievanceSchema } from "@/server/validation/public";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await checkRateLimit(req, "submit-grievance", {
      windowSeconds: 300,
      max: 10,
    });
    const body = validate(
      submitGrievanceSchema,
      await req.json().catch(() => ({})),
    );
    const result = await submitGrievance(body);
    return created(result, "Grievance submitted successfully");
  });
}
