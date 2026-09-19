import type { AIProvider } from "@/lib/ai/provider";
import { GroqProvider } from "@/lib/ai/providers/groq";
import { NullAIProvider } from "@/lib/ai/providers/null";

let cached: AIProvider | null = null;

/**
 * Resolves the configured AI backend.
 *
 * Only a real provider is cached. The null fallback is deliberately NOT
 * cached: if the module is first evaluated before the environment is fully
 * loaded (or the key is added while the process is running), caching the
 * fallback would leave AI permanently "unavailable" until a restart, even
 * though a valid key is sitting right there. Re-resolving on each call costs
 * nothing and makes the degraded state self-healing.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const providerName = process.env.AI_PROVIDER ?? "groq";

  if (providerName === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      cached = new GroqProvider(
        apiKey,
        process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b"
      );
      return cached;
    }
    console.warn("[ai] GROQ_API_KEY is not set; AI features will report as unavailable.");
  } else {
    console.warn(`[ai] Unknown AI_PROVIDER "${providerName}"; expected "groq".`);
  }

  return new NullAIProvider();
}

export { AIUnavailableError } from "@/lib/ai/provider";
export type { AIProvider } from "@/lib/ai/provider";
