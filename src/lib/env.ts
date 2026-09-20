/**
 * Environment expectations that differ between local development and a
 * deployed server.
 *
 * The pattern throughout is to be permissive locally and strict in
 * production. A missing variable on a laptop should not stop you working; the
 * same missing variable in production should fail loudly and immediately,
 * because the alternative is worse. An unset public URL, for instance, does
 * not announce itself: it quietly builds an OAuth redirect pointing at
 * localhost, and the only symptom is Google refusing a sign-in that looks
 * correct from the outside.
 */

const DEV_BASE_URL = "http://localhost:3000";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * The origin this server is reachable at, used to build OAuth redirect URIs.
 *
 * Auth.js reads AUTH_URL for its own callbacks and, separately, treats its
 * presence as permission to trust the incoming Host header. Setting it is
 * therefore not optional in production even though the variable itself is
 * conventionally described as optional.
 */
export function getBaseUrl(): string {
  const configured = process.env.AUTH_URL?.trim();

  if (configured) return configured.replace(/\/+$/, "");

  if (isProduction()) {
    throw new Error(
      "AUTH_URL is not set. It must be the full public origin of this " +
        "deployment, for example https://main.d1234abcd.amplifyapp.com. " +
        "Without it OAuth redirect URIs are built against localhost and every " +
        "Google sign-in fails."
    );
  }

  return DEV_BASE_URL;
}

/**
 * Checks the variables a deployed server cannot run correctly without, and
 * reports all of the missing ones at once rather than one per restart.
 *
 * Reports rather than throws, deliberately. Throwing here aborted the
 * instrumentation hook, which aborted server startup, which turned every route
 * into a bare 500 with no page and nothing on it: a single missing variable
 * became a total outage whose only explanation sat in a platform log someone
 * had to go and correlate by hand.
 *
 * Each of these already fails clearly where it is used. Auth.js refuses to
 * sign anything without AUTH_SECRET, Prisma cannot connect without
 * DATABASE_URL, getStorageProvider rejects local storage in production. Those
 * failures stay confined to the features that need them, so the rest of the
 * site stays up and the error names itself at the point it matters.
 *
 * What is kept is the summary: one line at boot naming what arrived and what
 * did not, which is what makes a misconfigured deployment diagnosable at all.
 * Does nothing outside production.
 */
export function assertProductionEnv(): void {
  if (!isProduction()) return;

  const problems: string[] = [];

  if (!process.env.DATABASE_URL) {
    problems.push("DATABASE_URL is not set.");
  } else if (/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL)) {
    problems.push(
      "DATABASE_URL points at localhost, which on managed hosting is the " +
        "application container itself, not a database."
    );
  }

  if (!process.env.AUTH_SECRET) {
    problems.push("AUTH_SECRET is not set. Generate one with `npx auth secret`.");
  }

  if (!process.env.AUTH_URL) {
    problems.push("AUTH_URL is not set. It must be this deployment's public origin.");
  }

  // Storage is warned about rather than fatal, unlike the variables above.
  //
  // The local provider cannot persist on serverless hosting: the filesystem is
  // read-only outside /tmp and /tmp is discarded between invocations. But
  // getStorageProvider() already refuses to hand back the local provider in
  // production, so an upload fails loudly at the point it is attempted.
  // Repeating that check here only widened the blast radius, taking the whole
  // deployment down at boot over a feature that nothing else depends on:
  // budgets, groups, sign-in and every other page work perfectly well without
  // receipt uploads. A misconfigured optional feature should disable that
  // feature, not the application.
  if ((process.env.STORAGE_PROVIDER ?? "local") === "local") {
    console.warn(
      "[env] STORAGE_PROVIDER is 'local', which managed hosting does not " +
        "persist. Receipt and file uploads will fail until STORAGE_PROVIDER " +
        "is set to 's3' with S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and " +
        "S3_SECRET_ACCESS_KEY. Everything else runs normally."
    );
  }

  // Names only, never values: this goes to the platform log, and knowing which
  // variables reached the runtime is the whole point of it.
  const seen = REPORTED_VARS.filter((name) => Boolean(process.env[name]));
  const unseen = REPORTED_VARS.filter((name) => !process.env[name]);
  console.info(`[env] present at runtime: ${seen.join(", ") || "(none)"}`);
  console.info(`[env] absent at runtime:  ${unseen.join(", ") || "(none)"}`);

  if (problems.length > 0) {
    console.error(
      "[env] This deployment is misconfigured. The server will start, but the " +
        "features that need these will fail:\n  - " +
        problems.join("\n  - ")
    );
  }
}

/** Reported at boot so a deployment's real environment is visible in the log. */
const REPORTED_VARS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "GROQ_API_KEY",
  "STORAGE_PROVIDER",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];
