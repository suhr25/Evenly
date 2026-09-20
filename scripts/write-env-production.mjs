/**
 * Copies the server-side environment variables from the build container into
 * the deployment, so the running server can read them.
 *
 * Amplify console variables reach the build container but are not injected
 * into the WEB_COMPUTE SSR runtime. Without this the deployed server starts
 * with an empty process.env and every feature needing a secret fails.
 *
 * Two files are written, for two different readers:
 *
 *   .env.production         dotenv format, at the project root. This is what
 *                           Next loads while constructing the server, and what
 *                           the build itself sees.
 *
 *   .next/env-runtime.json  JSON, inside the build output, written with
 *                           --into-next after the build. Read by
 *                           src/instrumentation-node.ts. It exists because the
 *                           Amplify artifact is the .next directory, so a file
 *                           beside it may not ship, and because JSON encodes
 *                           every possible value exactly.
 *
 * That second point is not theoretical. An earlier version wrote dotenv only,
 * and refused any value containing a single quote, because a single-quoted
 * dotenv value has no escape for one. A secret pasted into the console with
 * surrounding quotes was dropped in silence and read as unset at runtime.
 * JSON has no such gap: quotes, newlines and anything else survive intact.
 *
 * Values are never printed. Names only.
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const INTO_NEXT = process.argv.includes("--into-next");
const NL = String.fromCharCode(10);

/** Without these the server cannot do its job; see assertProductionEnv. */
const REQUIRED = ["DATABASE_URL", "AUTH_SECRET", "AUTH_URL"];

/** Features degrade without these, but the server still runs. */
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

const collected = {};
const written = [];
const missing = [];

for (const name of [...REQUIRED, ...OPTIONAL]) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    missing.push(name);
    continue;
  }
  collected[name] = value;
  written.push(name);
}

/**
 * dotenv encoding for the root file.
 *
 * Single quotes are literal in dotenv and safe for `#`, spaces, `=` and double
 * quotes, so they are the first choice. When the value contains a single quote
 * of its own there is no escape for it, and JSON.stringify's double-quoted
 * form is used instead: dotenv unescapes \n and \r inside double quotes, which
 * covers the cases that actually occur.
 *
 * Nothing is dropped either way. The JSON file is the authoritative copy for
 * the runtime, so a value neither quoting style expresses perfectly still
 * arrives intact there.
 */
function toDotenvLine(name, value) {
  const safeForSingleQuotes = !value.includes("'") && !value.includes(NL);
  return safeForSingleQuotes
    ? `${name}='${value}'`
    : `${name}=${JSON.stringify(value)}`;
}

if (written.length > 0) {
  if (INTO_NEXT) {
    if (!existsSync(".next")) mkdirSync(".next", { recursive: true });
    writeFileSync(
      path.join(".next", "env-runtime.json"),
      JSON.stringify(collected, null, 2) + NL
    );
  } else {
    const lines = written.map((name) => toDotenvLine(name, collected[name]));
    appendFileSync(".env.production", lines.join(NL) + NL);
  }
}

const target = INTO_NEXT ? ".next/env-runtime.json" : ".env.production";
const missingRequired = missing.filter((name) => REQUIRED.includes(name));

console.log(`Wrote ${written.length} variable(s) to ${target}.`);
console.log(`  present: ${written.join(", ") || "(none)"}`);
console.log(`  absent from the build container: ${missing.join(", ") || "(none)"}`);

if (missingRequired.length > 0) {
  console.log("");
  console.log(
    `WARNING: ${missingRequired.join(", ")} did not reach the build container. ` +
      "The server will still start, but the features needing them will fail. " +
      "Check these are set as Amplify environment variables (not secrets), are " +
      "in scope for this branch, and that a new build has run since they were added."
  );
}
