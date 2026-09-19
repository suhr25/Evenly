import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  describeGmailFailure,
  fetchRecentBankEmails,
  getValidAccessToken,
} from "@/lib/integrations/gmail";
import { parseTransactionEmail } from "@/lib/transaction-parser";
import { recordParsedTransaction } from "@/lib/data/pending-imports";

// The whole window is re-scanned on every sync rather than only mail newer
// than the last run: rows are kept as tombstones once confirmed or dismissed,
// so re-scanning can't duplicate anything, and it means an alert that arrived
// out of order (or a parser improvement) still gets picked up.
const LOOKBACK_DAYS = 90;

export const POST = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  if (!rateLimit(`gmail-sync:${session.user.id}`, 5, 60_000)) {
    throw new ApiError(429, "Too many sync requests. Please wait a moment.");
  }

  const connection = await prisma.gmailConnection.findUnique({ where: { userId: session.user.id } });
  if (!connection) throw new ApiError(400, "Connect Gmail first.");

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  let messages;
  try {
    const { accessToken, expiresAt, refreshed } = await getValidAccessToken(connection);
    if (refreshed) {
      await prisma.gmailConnection.update({
        where: { userId: session.user.id },
        data: { accessToken, expiresAt },
      });
    }
    messages = await fetchRecentBankEmails(accessToken, since);
  } catch (err) {
    console.error("[gmail-sync]", err);
    const { status, message } = describeGmailFailure(err);
    throw new ApiError(status, message);
  }

  let imported = 0;
  let unreadable = 0;
  for (const message of messages) {
    const parsed = parseTransactionEmail(message.subject, message.bodyText);
    if (!parsed) {
      unreadable += 1;
      continue;
    }
    const created = await recordParsedTransaction(
      session.user.id,
      message.id,
      parsed,
      message.internalDate,
      message.bodyText || message.subject
    );
    if (created) imported += 1;
  }

  await prisma.gmailConnection.update({
    where: { userId: session.user.id },
    data: { lastSyncedAt: new Date() },
  });

  return apiSuccess({ scanned: messages.length, imported, unreadable });
});
