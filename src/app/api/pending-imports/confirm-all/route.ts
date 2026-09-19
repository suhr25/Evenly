import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { confirmAllPendingImports } from "@/lib/data/pending-imports";

export const POST = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const result = await confirmAllPendingImports(session.user.id);
  return apiSuccess(result, 201);
});
