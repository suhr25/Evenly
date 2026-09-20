/**
 * Copies the server-side environment variables from the build container into
 * .env.production, which Next loads at server start when NODE_ENV=production.
 *
 * Amplify console variables reach the build container but are not injected
 * into the WEB_COMPUTE SSR runtime, so without this the deployed server starts
 * with an empty process.env and fails on the first thing needing a secret.
 *
 * Replaces an earlier `env | grep` one-liner for two reasons.
 *
 * Encoding: values are wrapped in single quotes, which dotenv treats as
 * literal. Raw unquoted values silently corrupt on a `#` (dotenv reads the
 * rest of the line as a comment) or on leading whitespace, and JSON.stringify
 * corrupts on an embedded double quote, because dotenv does not unescape \".
 * Single quotes survive `#`, spaces, `=`, `+`, `/` and double quotes, which
 * covers base64 secrets, connection strings and URLs.
 *
 * Reporting: the grep printed only the names it wrote, so a variable missing
 * from the build container looked identical to one that never reached the
 * runtime. Naming the missing ones separates those two failures, which are
 * fixed in completely different places.
 *
 * Values are never printed. Names only.
 */
import { appendFileSync } from "node:fs";

/** Without these the server cannot start; see assertProductionEnv. */
const REQUIRED = ["DATABASE_URL", "AUTH_SECRET", "AUTH_URL"];

/** Features degrade without these, but the server still boots. */
const OPTIONAL = [
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "GROQ_API_KEY",
  "AI_PROVIDER",
  "GROQ_MODEL",
  "GROQ_VISION_MODEL",
  "STORAGE_PROVIDER",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];

const written = [];
const missing = [];
const unencodable = [];
const lines = [];

for (const name of [...REQUIRED, ...OPTIONAL]) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    missing.push(name);
    continue;
  }
  // A single quote inside a single-quoted value cannot be escaped in dotenv
  // syntax. Refuse rather than write something that parses as the wrong value.
  if (value.includes("'")) {
    unencodable.push(name);
    continue;
  }
  lines.push(`${name}='${value}'`);
  written.push(name);
}

if (lines.length > 0) appendFileSync(".env.production", lines.join("\n") + "\n");

const missingRequired = missing.filter((n) => REQUIRED.includes(n));

console.log(`Wrote ${written.length} variable(s) to .env.production.`);
console.log(`  present: ${written.join(", ") || "(none)"}`);
console.log(`  absent from the build container: ${missing.join(", ") || "(none)"}`);

if (unencodable.length > 0) {
  console.log(
    `  NOT WRITTEN, value contains a single quote: ${unencodable.join(", ")}`
  );
}

if (missingRequired.length > 0) {
  console.log("");
  console.log(
    `WARNING: ${missingRequired.join(", ")} did not reach the build container, ` +
      "so the deployed server will refuse to start. Check that these are set " +
      "as Amplify environment variables (not secrets) and are in scope for " +
      "this branch, then redeploy: variable changes only take effect on a new build."
  );
}
