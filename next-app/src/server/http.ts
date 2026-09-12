import { type NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodSchema, type z } from "zod";
import { ApiError } from "./api-error";
import { connectToDatabase } from "./db";
import { env } from "./env";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ErrorDetail {
  [key: string]: string[];
}

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ success: true, data }, { status: init ?? 200 });
}

export function okMessage(message: string, data?: unknown) {
  return NextResponse.json({
    success: true,
    message,
    ...(data === undefined ? {} : { data }),
  });
}

export function created<T>(data: T, message: string) {
  return NextResponse.json({ success: true, message, data }, { status: 201 });
}

export function paginated<T>(
  data: T[],
  pagination: PaginationMeta,
  message?: string,
) {
  return NextResponse.json({
    success: true,
    ...(message ? { message } : {}),
    data,
    pagination,
  });
}

export function fail(status: number, message: string, errors?: ErrorDetail) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(errors ? { errors } : {}),
    },
    { status },
  );
}

export function flattenZodError(error: ZodError): ErrorDetail {
  const errors: ErrorDetail = {};
  for (const issue of error.errors) {
    const path = issue.path.join(".") || "_";
    if (!errors[path]) errors[path] = [];
    errors[path].push(issue.message);
  }
  return errors;
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return fail(err.statusCode, err.message);
  }
  if (err instanceof ZodError) {
    return fail(400, "Validation error", flattenZodError(err));
  }
  const anyErr = err as { name?: string; code?: number; message?: string };
  if (anyErr?.name === "ValidationError") {
    return fail(400, "Validation error");
  }
  if (anyErr?.code === 11000) {
    return fail(409, "Resource already exists");
  }
  console.error("[API ERROR]", err);
  return fail(
    500,
    env.NODE_ENV === "production"
      ? "Internal server error"
      : (anyErr?.message ?? "Internal server error"),
  );
}

/**
 * Parse and validate a value against a Zod schema, throwing a ZodError on
 * failure so the shared error handler can format it. Returns the schema's
 * output type so `.default()` / `.transform()` values are applied.
 */
export function validate<S extends ZodSchema>(
  schema: S,
  value: unknown,
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw result.error;
  return result.data;
}

/** Collect all search params from the request as a plain object. */
export function readQuery(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}

/**
 * Wrap a Route Handler so the database is connected and every thrown error is
 * converted into the standard error envelope.
 */
export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    await connectToDatabase();
    return await fn();
  } catch (err) {
    return toErrorResponse(err);
  }
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
