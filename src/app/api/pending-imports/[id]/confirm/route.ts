import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { confirmPendingImport } from "@/lib/data/pending-imports";
import { confirmPendingImportSchema } from "@/lib/validations/pending-imports";

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const data = confirmPendingImportSchema.parse(await req.json());

    const result = await confirmPendingImport(session.user.id, id, data);
    return apiSuccess(result, 201);
  }
);
