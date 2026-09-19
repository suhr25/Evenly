import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { revokeGmailAccess } from "@/lib/integrations/gmail";

export const GET = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const connection = await prisma.gmailConnection.findUnique({ where: { userId: session.user.id } });
  return apiSuccess({
    connected: Boolean(connection),
    emailAddress: connection?.emailAddress ?? null,
    lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
  });
});

export const DELETE = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const connection = await prisma.gmailConnection.findUnique({ where: { userId: session.user.id } });
  if (connection) {
    await revokeGmailAccess(connection.accessToken);
    await prisma.gmailConnection.delete({ where: { userId: session.user.id } });
  }

  return apiSuccess({ ok: true });
});
