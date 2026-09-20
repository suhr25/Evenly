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
 * Called for its side effect of throwing. Does nothing outside production, so
 * local development keeps working with a partial .env.
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

  // Storage defaults to the local filesystem, which does not survive on
  // serverless hosting: the directory is read-only outside /tmp, and /tmp is
  // discarded between invocations. Uploads would appear to succeed and then
  // vanish, which is worse than refusing to start.
  if ((process.env.STORAGE_PROVIDER ?? "local") === "local") {
    problems.push(
      "STORAGE_PROVIDER is 'local', which writes to a filesystem that managed " +
        "hosting does not persist. Set it to 's3' and supply S3_BUCKET, " +
        "S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY."
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Cannot start: this deployment is misconfigured.\n  - ${problems.join("\n  - ")}`
    );
  }
}
