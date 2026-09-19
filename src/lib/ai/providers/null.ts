import type { AIProvider } from "@/lib/ai/provider";
import { AIUnavailableError } from "@/lib/ai/provider";

/** Used whenever no AI credentials are configured. Every call fails loudly
 * with a typed error so callers can show "AI unavailable" UI instead of the
 * rest of the app breaking. */
export class NullAIProvider implements AIProvider {
  async generateResponse(): Promise<string> {
    throw new AIUnavailableError();
  }
  async generateToolResponse(): Promise<string> {
    throw new AIUnavailableError();
  }
  async categorizeExpense(): Promise<never> {
    throw new AIUnavailableError();
  }
  async parseExpenseText(): Promise<never> {
    throw new AIUnavailableError();
  }
  async analyzeReceipt(): Promise<never> {
    throw new AIUnavailableError();
  }
  async generateInsight(): Promise<never> {
    throw new AIUnavailableError();
  }
  async analyzePurchase(): Promise<never> {
    throw new AIUnavailableError();
  }
}
