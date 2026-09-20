/**
 * Runs once when the server starts, before it handles any request.
 *
 * Next calls register in every runtime, so the Node-only work lives in a
 * separate module behind this check. Importing it conditionally is what keeps
 * `node:fs` out of the edge bundle: a static import there fails the build even
 * when the guard means it could never run.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
