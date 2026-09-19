import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { listPendingImports } from "@/lib/data/pending-imports";

export const GET = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const imports = await listPendingImports(session.user.id);
  return apiSuccess({ imports });
});
