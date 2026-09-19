import type {
  AIChatMessage,
  AIInsight,
  AIToolDefinition,
  AIToolExecutor,
  CategorySuggestion,
  FinancialSnapshot,
  ParsedExpense,
  PurchaseAnalysis,
  ReceiptExtraction,
} from "@/types/ai";

export class AIUnavailableError extends Error {
  constructor(message = "AI features are currently unavailable.") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export interface AIProvider {
  generateResponse(messages: AIChatMessage[], systemPrompt?: string): Promise<string>;
  /** Runs a full tool-use loop: calls the model, executes any tool calls it
   * requests via `executeTool`, feeds the results back, and repeats until the
   * model produces a final text answer. */
  generateToolResponse(
    messages: AIChatMessage[],
    tools: AIToolDefinition[],
    executeTool: AIToolExecutor,
    systemPrompt?: string
  ): Promise<string>;
  categorizeExpense(description: string, amount: number): Promise<CategorySuggestion>;
  parseExpenseText(text: string, availableCategories: string[]): Promise<ParsedExpense>;
  analyzeReceipt(imageBase64: string, mediaType: string): Promise<ReceiptExtraction>;
  generateInsight(snapshot: FinancialSnapshot): Promise<AIInsight[]>;
  analyzePurchase(
    product: string,
    price: number,
    snapshot: FinancialSnapshot
  ): Promise<PurchaseAnalysis>;
}
