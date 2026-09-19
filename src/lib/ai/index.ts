import type { AIProvider } from "@/lib/ai/provider";
import { GroqProvider } from "@/lib/ai/providers/groq";
import { NullAIProvider } from "@/lib/ai/providers/null";

let cached: AIProvider | null = null;

/**
 * Resolves the configured AI backend once per process.
 *
 * Falls back to NullAIProvider whenever no key is set, so AI-dependent
 * features degrade to an "unavailable" message instead of throwing. The
 * AIProvider interface keeps this swappable: adding another backend means
 * one new implementation and one branch here, nothing else changes.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const providerName = process.env.AI_PROVIDER ?? "groq";

  if (providerName === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    const visionModel = process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b";
    cached = apiKey ? new GroqProvider(apiKey, model, visionModel) : new NullAIProvider();
  } else {
    cached = new NullAIProvider();
  }

  return cached;
}

export { AIUnavailableError } from "@/lib/ai/provider";
export type { AIProvider } from "@/lib/ai/provider";
