import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AIUnavailableError } from "@/lib/ai/provider";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(status: number, message: string) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Wraps a route handler: validation errors and ApiError become friendly
 * client-facing messages, anything unexpected is logged server-side and
 * returned as a generic 500 so we never leak stack traces or DB errors.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return apiError(err.status, err.message);
      }
      if (err instanceof ZodError) {
        return apiError(400, err.issues.map((i) => i.message).join(", "));
      }
      if (err instanceof AIUnavailableError) {
        return apiError(503, err.message);
      }
      console.error("[api-error]", err);
      return apiError(500, "Something went wrong. Please try again.");
    }
  };
}
