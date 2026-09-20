import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { assertProductionEnv } from "@/lib/env";

/**
 * Node-runtime startup work, imported only from src/instrumentation.ts.
 *
 * Configuration mistakes are cheapest to find here. Left to surface at request
 * time they arrive as whatever the first affected feature happens to throw,
 * which is rarely a description of the actual problem: a missing AUTH_URL
 * reads as a rejected Google sign-in, and an unreachable database reads, via
 * Auth.js, as a server misconfiguration. Checking up front turns all of those
 * into one message naming the variable.
 */
loadDeployedEnv();
assertProductionEnv();

/**
 * Makes sure the deployed environment is loaded before anything validates it.
 *
 * Next loads env files from the project root while constructing the server, so
 * the first call here is normally a no-op. The second lookup is the one that
 * matters on Amplify: the deployment artifact is the .next directory, so a
 * file written beside it during the build is not necessarily part of what
 * ships. The build writes a copy inside .next, which is unambiguously in the
 * artifact but is not a location Next searches.
 *
 * That copy is read directly rather than through loadEnvConfig, which is the
 * wrong tool for a second directory: it caches after its first call and
 * returns early, and forcing past that cache resets process.env to the
 * snapshot it took at startup, discarding anything already loaded.
 *
 * Existing values always win, so variables the platform injects into the
 * runtime are never overwritten by the file.
 */
function loadDeployedEnv(): void {
  loadEnvConfig(process.cwd());

  const file = path.join(process.cwd(), ".next", ".env.production");
  if (!existsSync(file)) return;

  let contents: string;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    // Unreadable is the same as absent: the validation reports whatever ends
    // up missing, which is more useful than failing on the read itself.
    return;
  }

  // Minimal reader for the file scripts/write-env-production.mjs emits: one
  // KEY='value' per line, single-quoted, no escapes. We own both ends of that
  // format, so it needs no general-purpose dotenv parsing.
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    const quoted =
      value.length >= 2 &&
      ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"')));
    if (quoted) value = value.slice(1, -1);

    const current = process.env[key];
    if (current === undefined || current === "") process.env[key] = value;
  }
}
