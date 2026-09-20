import { google, type gmail_v1 } from "googleapis";
import { getBaseUrl } from "@/lib/env";

// Reuses the same Google Cloud OAuth client already configured for
// "Sign in with Google" (AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET). This is a
// completely separate consent flow with its own redirect URI and its own
// (read-only, Gmail-only) scope, so it never touches or widens what the
// login flow can do.
export const isGmailSyncEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

export const GMAIL_CALLBACK_PATH = "/api/integrations/gmail/callback";
const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export class GmailNotConfiguredError extends Error {
  constructor() {
    super("Gmail sync isn't configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.");
    this.name = "GmailNotConfiguredError";
  }
}

function createOAuthClient() {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) throw new GmailNotConfiguredError();
  return new google.auth.OAuth2(clientId, clientSecret, `${getBaseUrl()}${GMAIL_CALLBACK_PATH}`);
}

export function getGmailAuthUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GMAIL_READONLY_SCOPE, USERINFO_EMAIL_SCOPE],
    state,
  });
}

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  emailAddress: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GmailTokens> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token. Revoke Evenly's access at https://myaccount.google.com/permissions and try connecting again."
    );
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  if (!data.email) throw new Error("Google didn't return an email address for this account.");

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date ?? Date.now() + 55 * 60_000),
    emailAddress: data.email,
  };
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/** Returns a live access token, refreshing it first if it has expired. */
export async function getValidAccessToken(
  stored: StoredTokens
): Promise<{ accessToken: string; expiresAt: Date; refreshed: boolean }> {
  if (stored.expiresAt.getTime() - Date.now() > 60_000) {
    return { accessToken: stored.accessToken, expiresAt: stored.expiresAt, refreshed: false };
  }

  const client = createOAuthClient();
  client.setCredentials({ refresh_token: stored.refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error("Failed to refresh Gmail access token.");

  return {
    accessToken: credentials.access_token,
    expiresAt: new Date(credentials.expiry_date ?? Date.now() + 55 * 60_000),
    refreshed: true,
  };
}

export async function revokeGmailAccess(accessToken: string): Promise<void> {
  const client = createOAuthClient();
  try {
    await client.revokeToken(accessToken);
  } catch {
    // Best-effort: the token may already be invalid/expired. The local
    // connection row is deleted regardless by the caller.
  }
}

/**
 * Translates a googleapis failure into something the user can act on.
 * Worth the specificity: nearly every failure mode here is an unfinished
 * setup step in Google Cloud or a revoked grant, and a generic "something
 * went wrong" leaves the user with no way to tell which.
 */
export function describeGmailFailure(err: unknown): { status: number; message: string } {
  const raw = err as { status?: unknown; cause?: { message?: unknown }; message?: unknown };
  const status = typeof raw?.status === "number" ? raw.status : 0;
  const detail = String(raw?.cause?.message ?? raw?.message ?? "");

  if (status === 403 && /has not been used in project|is disabled/i.test(detail)) {
    return {
      status: 400,
      message:
        "The Gmail API isn't enabled in your Google Cloud project yet. Enable it in the API Library, wait a minute, then sync again.",
    };
  }
  if (status === 403) {
    return {
      status: 400,
      message:
        "Google refused the Gmail request. The gmail.readonly scope may be missing. Disconnect and reconnect Gmail to re-approve access.",
    };
  }
  if (status === 401 || /invalid_grant/i.test(detail)) {
    return {
      status: 400,
      message: "Gmail access expired or was revoked. Disconnect and reconnect Gmail.",
    };
  }
  if (status === 429) {
    return { status: 429, message: "Gmail rate limit reached. Wait a minute and sync again." };
  }
  return { status: 502, message: "Couldn't reach Gmail. Please try again." };
}

export interface GmailMessageSummary {
  id: string;
  internalDate: Date;
  subject: string;
  from: string;
  bodyText: string;
}

// Bank alert emails don't share one sender domain or subject line across
// issuers, and hardcoding a guessed list of "known" bank sender addresses
// would be worse than not filtering at all. It would silently miss real
// alerts from banks not on the list while looking falsely authoritative.
// Instead this searches for the language actually common to transaction
// alerts, and leaves the real accuracy work to the parser, which only ever
// accepts an email it can confidently extract an amount and direction from.
function buildSearchQuery(sinceDate: Date): string {
  const days = Math.max(1, Math.ceil((Date.now() - sinceDate.getTime()) / 86_400_000));
  const phrases = [
    "debited",
    "credited",
    '"has been debited"',
    '"has been credited"',
    '"spent using"',
    '"spent on your"',
    '"transaction alert"',
    '"payment of"',
    '"upi payment"',
    '"paid to"',
    '"sent to"',
    '"withdrawn"',
    '"transaction on"',
    '"txn of"',
  ];
  // Deliberately not filtered to category:primary, Gmail files most bank
  // transaction alerts under the Updates tab, so that filter was hiding the
  // majority of them. The parser is the accuracy gate, not the search query.
  return `newer_than:${days}d (${phrases.join(" OR ")})`;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ");
  }
  return "";
}

function header(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Upper bound on messages pulled in one sync, so an inbox with years of
 * alerts can't turn a single click into a runaway job. */
const MAX_MESSAGES = 500;
const PAGE_SIZE = 100;
// Gmail bills each messages.get against a per-minute "query cost" quota;
// fetching too many at once trips a 403 rateLimitExceeded mid-sync.
const DETAIL_CONCURRENCY = 4;
const MAX_RETRIES = 4;

function isRateLimited(err: unknown): boolean {
  const raw = err as { status?: unknown; cause?: { message?: unknown } };
  const detail = String(raw?.cause?.message ?? "");
  return raw?.status === 429 || (raw?.status === 403 && /quota|rate limit/i.test(detail));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries a Gmail call through rate-limit responses with exponential
 * backoff. Without this a large mailbox reliably fails partway through a
 * sync, which looks to the user like "it only found some of them". */
async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimited(err)) throw err;
      lastError = err;
      await sleep(2 ** attempt * 1000 + Math.random() * 400);
    }
  }
  throw lastError;
}

export async function fetchRecentBankEmails(
  accessToken: string,
  sinceDate: Date
): Promise<GmailMessageSummary[]> {
  const client = createOAuthClient();
  client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: client });
  const q = buildSearchQuery(sinceDate);

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const list = await withRateLimitRetry(() =>
      gmail.users.messages.list({ userId: "me", q, maxResults: PAGE_SIZE, pageToken })
    );
    for (const message of list.data.messages ?? []) {
      if (message.id) ids.push(message.id);
    }
    pageToken = list.data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < MAX_MESSAGES);

  const capped = ids.slice(0, MAX_MESSAGES);

  // Fetched in bounded parallel batches: one-at-a-time makes a few hundred
  // messages take minutes. A message that still fails after retries is
  // skipped rather than aborting the sync. Importing most of the mailbox
  // beats failing all of it.
  const messages: GmailMessageSummary[] = [];
  for (let i = 0; i < capped.length; i += DETAIL_CONCURRENCY) {
    const batch = await Promise.all(
      capped.slice(i, i + DETAIL_CONCURRENCY).map(async (id) => {
        try {
          const { data } = await withRateLimitRetry(() =>
            gmail.users.messages.get({ userId: "me", id, format: "full" })
          );
          const headers = data.payload?.headers;
          return {
            id,
            internalDate: new Date(Number(data.internalDate ?? Date.now())),
            subject: header(headers, "Subject"),
            from: header(headers, "From"),
            bodyText: extractPlainText(data.payload) || data.snippet || "",
          };
        } catch (err) {
          console.error("[gmail] skipping message", id, err);
          return null;
        }
      })
    );
    for (const message of batch) {
      if (message) messages.push(message);
    }
  }
  return messages;
}
