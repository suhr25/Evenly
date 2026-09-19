import { z } from "zod";
import { listUserCards, computePortfolioSummary } from "@/lib/data/cards";
import { computeCardInsights } from "@/lib/data/card-insights";
import { listDiscoverableCardProducts, recommendDiscoveryCard } from "@/lib/data/discovery";
import { recommendBestCard } from "@/lib/data/recommendations";
import { prisma } from "@/lib/prisma";
import type { AIToolDefinition } from "@/types/ai";

// Portfolio Mode tools (getMyCreditCards, getBestCardToUseNow, getCardInsights) only ever
// read from the user's owned UserCard rows. Discovery Mode tools (discoverCreditCards,
// recommendNewCreditCard) only ever read from the catalog of cards the user does NOT own.
// This split mirrors src/lib/data/cards.ts vs src/lib/data/discovery.ts on purpose: the
// model should never be able to blur "cards you have" with "cards you could get" by calling
// the wrong tool, and the tool descriptions below tell it exactly when each applies.
export const CARD_TOOLS: AIToolDefinition[] = [
  {
    name: "getMyCreditCards",
    description:
      "Get the user's own credit card portfolio: each owned card's issuer, name, credit limit, outstanding balance, utilization percent, and reward balance, plus a total summary. Use this for 'what cards do I have' or 'what's my utilization' style questions. Never use this to answer questions about cards the user doesn't own.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "getBestCardToUseNow",
    description:
      "Recommend which of the user's OWN credit cards to use for a specific purchase, ranked by estimated reward value with a utilization-aware override. Only ever chooses among cards the user already owns. Never suggests a card they don't have. Use this whenever the user asks 'which of my cards should I use for X' without asking about getting a new card.",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "string", description: "Transaction amount, e.g. \"2500\"" },
        category: { type: ["string", "null"], description: "Spend category name, e.g. Dining, Grocery, Travel. Omit if unclear." },
        isOnline: { type: ["boolean", "null"], description: "Whether the purchase is online. Defaults to offline if unclear." },
      },
      required: ["amount"],
    },
  },
  {
    name: "getCardInsights",
    description:
      "Get proactive insights about the user's own cards: upcoming payment due dates, high utilization warnings, and rewards they recently missed by using the wrong owned card. Use this for 'anything I should know about my cards' style questions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "discoverCreditCards",
    description:
      "Search the catalog of Indian credit cards the user does NOT currently own (issuer, fees, reward structure). Only call this when the user explicitly asks about getting a new card, or asks about a specific card/issuer by name that isn't in their portfolio. Never call this to answer questions about the user's own cards.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: ["string", "null"], description: "Free-text search, e.g. a card name or issuer like \"Infinia\" or \"HSBC\". Omit to browse broadly." },
      },
    },
  },
  {
    name: "recommendNewCreditCard",
    description:
      "Recommend a NEW credit card (one the user doesn't already own) for a specific spending pattern, from the full catalog. Only call this when the user explicitly asks whether they should get a new card, or asks 'what's the best card for X' in a context that isn't limited to their own portfolio. Always make clear to the user that these are cards they don't currently own and this is informational, not an instruction to apply.",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "string", description: "Typical transaction amount, e.g. \"2500\"" },
        category: { type: ["string", "null"], description: "Spend category name, e.g. Dining, Grocery, Travel. Omit if unclear." },
        isOnline: { type: ["boolean", "null"], description: "Whether the purchase is online. Defaults to offline if unclear." },
      },
      required: ["amount"],
    },
  },
];

async function resolveCategoryId(category: string | null | undefined): Promise<string | null> {
  if (!category) return null;
  const match = await prisma.expenseCategory.findFirst({
    where: { name: { equals: category, mode: "insensitive" } },
  });
  return match?.id ?? null;
}

async function getMyCreditCards(userId: string) {
  const cards = await listUserCards(userId);
  const summary = computePortfolioSummary(cards);
  return {
    summary,
    cards: cards.map((c) => ({
      nickname: c.nickname ?? `${c.cardProduct.issuerName} ${c.cardProduct.name}`,
      issuer: c.cardProduct.issuerName,
      name: c.cardProduct.name,
      lastFourDigits: c.lastFourDigits,
      creditLimit: c.creditLimit,
      outstanding: c.outstanding,
      utilizationPercent: c.utilizationPercent,
      rewardBalance: c.rewardBalance,
      paymentDueDate: c.paymentDueDate,
    })),
  };
}

const recommendInput = z.object({
  amount: z.string(),
  category: z.string().nullish(),
  isOnline: z.boolean().nullish(),
});

async function getBestCardToUseNow(userId: string, input: unknown) {
  const { amount, category, isOnline } = recommendInput.parse(input);
  const categoryId = await resolveCategoryId(category);
  return recommendBestCard(userId, { amount, categoryId, channel: isOnline ? "ONLINE" : "OFFLINE" });
}

async function getCardInsights(userId: string, currency: string) {
  const insights = await computeCardInsights(userId, currency);
  return { insights };
}

const discoverInput = z.object({ search: z.string().nullish() });

async function discoverCreditCards(userId: string, input: unknown) {
  const { search } = discoverInput.parse(input);
  const cards = await listDiscoverableCardProducts(userId, search ?? undefined);
  return {
    cards: cards.slice(0, 15).map((c) => ({
      issuer: c.issuerName,
      name: c.name,
      network: c.network,
      annualFee: c.annualFee,
      joiningFee: c.joiningFee,
      rewardCurrency: c.rewardCurrencyName,
      bestUsedFor: c.bestUsedFor,
    })),
  };
}

async function recommendNewCreditCard(userId: string, input: unknown) {
  const { amount, category, isOnline } = recommendInput.parse(input);
  const categoryId = await resolveCategoryId(category);
  const results = await recommendDiscoveryCard(userId, { amount, categoryId, channel: isOnline ? "ONLINE" : "OFFLINE" });
  return { candidates: results };
}

export function createCardToolExecutor(userId: string, currency: string) {
  return async (name: string, input: Record<string, unknown>): Promise<unknown> => {
    switch (name) {
      case "getMyCreditCards":
        return getMyCreditCards(userId);
      case "getBestCardToUseNow":
        return getBestCardToUseNow(userId, input);
      case "getCardInsights":
        return getCardInsights(userId, currency);
      case "discoverCreditCards":
        return discoverCreditCards(userId, input);
      case "recommendNewCreditCard":
        return recommendNewCreditCard(userId, input);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  };
}
