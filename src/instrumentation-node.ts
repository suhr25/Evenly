import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { assertProductionEnv } from "@/lib/env";

/**
 * Node-runtime startup work, imported only from src/instrumentation.ts.
 *
 * Loads whatever environment the deployment shipped, then reports on it. The
 * report never throws: see assertProductionEnv for why a validator must not be
 * the thing that takes a site down.
 */
loadDeployedEnv();
assertProductionEnv();

/**
 * Makes sure the deployed environment is loaded before anything reads it.
 *
 * Next loads env files from the project root while constructing the server, so
 * the first call here is normally a no-op. The second file is the one that
 * matters on Amplify: the deployment artifact is the .next directory, so a
 * file written beside it during the build is not necessarily part of what
 * ships. The build writes a copy inside .next, which is unambiguously in the
 * artifact but is not a location Next searches.
 *
 * That copy is JSON rather than dotenv, and is read directly here. JSON
 * because it encodes every possible value exactly: the dotenv writer this
 * replaced silently dropped any secret containing a single quote, which is
 * easy to introduce by pasting a value into a console with quotes around it,
 * and the result was a variable that looked simply unset. loadEnvConfig is not
 * used for it because that function caches after its first call and returns
 * early, and forcing past the cache resets process.env to the snapshot taken
 * at startup, discarding anything already loaded.
 *
 * Existing values always win, so variables the platform injects into the
 * runtime are never overwritten by the file.
 */
function loadDeployedEnv(): void {
  loadEnvConfig(process.cwd());

  const file = path.join(process.cwd(), ".next", "env-runtime.json");
  if (!existsSync(file)) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // Unreadable or malformed is the same as absent: the report below names
    // whatever ends up missing, which is more use than failing on the read.
    return;
  }

  if (typeof parsed !== "object" || parsed === null) return;

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const current = process.env[key];
    if (current === undefined || current === "") process.env[key] = value;
  }
}
