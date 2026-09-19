export interface AIInsight {
  title: string;
  description: string;
  severity: "info" | "warning" | "positive";
}

export interface ReceiptItemExtraction {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptExtraction {
  merchant: string | null;
  date: string | null; // ISO date
  items: ReceiptItemExtraction[];
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  total: number | null;
  confidence: "high" | "medium" | "low";
}

export interface CategorySuggestion {
  category: string;
  confidence: number; // 0-1
}

export interface ParsedExpense {
  amount: number;
  category: string;
  description: string;
}

export interface PurchaseAnalysis {
  verdict: "comfortable" | "consider" | "high_impact";
  reasoning: string;
}

/** Pre-computed, real numbers handed to the AI: never raw DB rows or free-form access. */
export interface FinancialSnapshot {
  currency: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  currentBalance: number;
  categorySpending: Record<string, number>;
  previousMonthCategorySpending?: Record<string, number>;
  budgets: { category: string; budget: number; spent: number }[];
}

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** Executes one financial-data tool call server-side, scoped to the current
 * user, and returns a JSON-serializable result for the model to reason over. */
export type AIToolExecutor = (name: string, input: Record<string, unknown>) => Promise<unknown>;
