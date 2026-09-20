import { assertProductionEnv } from "@/lib/env";

/**
 * Runs once when the server starts, before it handles any request.
 *
 * Configuration mistakes are cheapest to find here. Left to surface at request
 * time they arrive as whatever the first affected feature happens to throw,
 * which is rarely a description of the actual problem: a missing AUTH_URL
 * reads as a rejected Google sign-in, and an unreachable database reads, via
 * Auth.js, as a server misconfiguration. Checking up front turns all of those
 * into one message naming the variable.
 *
 * Only the Node.js runtime is checked. The edge runtime does not see the same
 * environment and runs no database or storage code.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  assertProductionEnv();
}
