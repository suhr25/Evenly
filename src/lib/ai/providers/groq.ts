import OpenAI from "openai";
import type { AIProvider } from "@/lib/ai/provider";
import { DEFAULT_CATEGORIES, extractJson } from "@/lib/ai/shared";
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

const MAX_TOOL_ROUNDTRIPS = 6;
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Groq exposes an OpenAI-compatible Chat Completions API, so this talks to
 * it via the `openai` SDK pointed at Groq's base URL instead of a
 * Groq-specific client. */
export class GroqProvider implements AIProvider {
  private client: OpenAI;
  private model: string;
  private visionModel: string;

  constructor(apiKey: string, model: string, visionModel: string) {
    // Groq rate-limits aggressively on the free tier and occasionally 5xxs.
    // Retrying transient failures in the SDK is the difference between the
    // dashboard showing real insights and showing "AI unavailable" because
    // one request happened to land badly.
    this.client = new OpenAI({
      apiKey,
      baseURL: GROQ_BASE_URL,
      maxRetries: 3,
      timeout: 30_000,
    });
    this.model = model;
    this.visionModel = visionModel;
  }

  async generateResponse(messages: AIChatMessage[], systemPrompt?: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    return response.choices[0]?.message?.content ?? "";
  }

  async generateToolResponse(
    messages: AIChatMessage[],
    tools: AIToolDefinition[],
    executeTool: AIToolExecutor,
    systemPrompt?: string
  ): Promise<string> {
    const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));

    const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDTRIPS; round++) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1024,
        messages: conversation,
        tools: openaiTools,
      });

      const message = response.choices[0]?.message;
      const toolCalls = message?.tool_calls;
      if (!message || !toolCalls || toolCalls.length === 0) {
        return message?.content ?? "";
      }

      conversation.push(message);

      for (const call of toolCalls) {
        if (call.type !== "function") continue;
        let resultText: string;
        try {
          const input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          const result = await executeTool(call.function.name, input);
          resultText = JSON.stringify(result);
        } catch (err) {
          resultText = JSON.stringify({ error: err instanceof Error ? err.message : "Tool failed" });
        }
        conversation.push({ role: "tool", tool_call_id: call.id, content: resultText });
      }
    }

    return "I wasn't able to finish answering that. Please try rephrasing your question.";
  }

  async categorizeExpense(description: string, amount: number): Promise<CategorySuggestion> {
    const text = await this.generateResponse(
      [
        {
          role: "user",
          content: `Expense description: "${description}", amount: ${amount}. Choose the single best category from: ${DEFAULT_CATEGORIES.join(", ")}. Respond with ONLY JSON: {"category": string, "confidence": number between 0 and 1}.`,
        },
      ],
      "You categorize personal expenses. Always respond with strict JSON only, no prose."
    );
    return extractJson<CategorySuggestion>(text);
  }

  async parseExpenseText(text: string, availableCategories: string[]): Promise<ParsedExpense> {
    const categories = availableCategories.length ? availableCategories : DEFAULT_CATEGORIES;
    const response = await this.generateResponse(
      [
        {
          role: "user",
          content: `Parse this spoken/typed expense entry into structured data: "${text}"
Choose the single best category from: ${categories.join(", ")}.
Respond with ONLY JSON: {"amount": number, "category": string, "description": string (short, e.g. "Lunch", "Uber ride")}.
If no amount is mentioned, set amount to 0. Never invent an amount that wasn't stated.`,
        },
      ],
      "You extract structured expense data from natural language. Always respond with strict JSON only, no prose."
    );
    return extractJson<ParsedExpense>(response);
  }

  async analyzeReceipt(imageBase64: string, mediaType: string): Promise<ReceiptExtraction> {
    const response = await this.client.chat.completions.create({
      model: this.visionModel,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "You extract structured data from receipt/bill images. Always respond with strict JSON only, no prose, matching the exact schema requested.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
            {
              type: "text",
              text: `Extract this receipt as JSON matching exactly:
{
  "merchant": string | null,
  "date": string | null (ISO 8601 date),
  "items": [{ "name": string, "quantity": number, "unitPrice": number, "totalPrice": number }],
  "subtotal": number | null,
  "tax": number | null,
  "discount": number | null,
  "tip": number | null,
  "total": number | null,
  "confidence": "high" | "medium" | "low"
}
If the image is unreadable or not a receipt, set confidence to "low" and fill unknown fields with null / empty array.`,
            },
          ],
        },
      ],
    });
    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("No text response from AI");
    return extractJson<ReceiptExtraction>(text);
  }

  async generateInsight(snapshot: FinancialSnapshot): Promise<AIInsight[]> {
    const text = await this.generateResponse(
      [
        {
          role: "user",
          content: `Here is the user's real financial data (currency: ${snapshot.currency}):
${JSON.stringify(snapshot, null, 2)}

Generate 1-3 short, specific, useful financial insights based ONLY on this data. Do not invent numbers not present above. Respond with ONLY a JSON array: [{"title": string, "description": string, "severity": "info"|"warning"|"positive"}].`,
        },
      ],
      "You are a financial insight generator. Never fabricate numbers, only reason about the data given. Always respond with strict JSON only."
    );
    return extractJson<AIInsight[]>(text);
  }

  async analyzePurchase(
    product: string,
    price: number,
    snapshot: FinancialSnapshot
  ): Promise<PurchaseAnalysis> {
    const text = await this.generateResponse(
      [
        {
          role: "user",
          content: `The user is considering buying "${product}" for ${price} ${snapshot.currency}.
Their real financial data: ${JSON.stringify(snapshot, null, 2)}

Analyze the impact of this purchase. Respond with ONLY JSON: {"verdict": "comfortable"|"consider"|"high_impact", "reasoning": string (2-3 sentences, explain why using the actual numbers, never say "you should definitely buy/not buy")}.`,
        },
      ],
      "You are a cautious financial assistant. Never give absolute directives, only balanced analysis grounded in the provided data. Always respond with strict JSON only."
    );
    return extractJson<PurchaseAnalysis>(text);
  }
}
