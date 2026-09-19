import { NextRequest } from "next/server";
import { getAIProvider } from "@/lib/ai";
import { CARD_TOOLS, createCardToolExecutor } from "@/lib/ai/card-tools";
import { FINANCIAL_TOOLS, createFinancialToolExecutor } from "@/lib/ai/financial-tools";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { sendChatMessageSchema } from "@/lib/validations/ai";
import type { AIToolExecutor } from "@/types/ai";

const HISTORY_LIMIT = 20;
const ALL_TOOLS = [...FINANCIAL_TOOLS, ...CARD_TOOLS];
const CARD_TOOL_NAMES = new Set(CARD_TOOLS.map((t) => t.name));

function combineExecutors(financial: AIToolExecutor, card: AIToolExecutor): AIToolExecutor {
  return (name, input) => (CARD_TOOL_NAMES.has(name) ? card(name, input) : financial(name, input));
}

function systemPrompt(currency: string) {
  return `You are Evenly's financial assistant. You answer questions about the user's own money and credit cards using ONLY the data returned by your tools; never invent or estimate a number that a tool didn't give you.

Rules:
- Always call a tool before stating any figure (amounts, balances, percentages, dates, fees, reward rates).
- If a tool returns no data for what's asked, say so plainly rather than guessing.
- Amounts are in ${currency}. Format them naturally (e.g. "${currency === "INR" ? "₹2,500" : `${currency} 2,500`}").
- Keep answers short and conversational, a few sentences unless a list is clearly useful.
- You are not a licensed financial advisor. For big decisions, note that this is informational, not advice.

Credit card rules:
- When asked "which card should I use", default to the user's OWN cards (getBestCardToUseNow / getMyCreditCards / getCardInsights). Only reach for discoverCreditCards or recommendNewCreditCard when the user explicitly asks about getting a new card, or names a card/issuer they don't own.
- Never blend owned and not-owned cards in the same recommendation. If you used discoverCreditCards or recommendNewCreditCard, say plainly that these are cards the user does not currently own.
- Never state a card's fee, reward rate, or benefit unless a tool returned it. If a tool omits a field, say it isn't confirmed rather than filling it in.
- Never encourage spending more just to earn rewards.
- Never ask the user for their card number, CVV, OTP, PIN, or any bank password. You never need these for anything you do.`;
}

async function getOrCreateConversation(userId: string) {
  const existing = await prisma.aIConversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  return prisma.aIConversation.create({ data: { userId } });
}

export const GET = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const conversation = await prisma.aIConversation.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return apiSuccess({
    messages: (conversation?.messages ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  if (!rateLimit(`ai-chat:${session.user.id}`, 20, 60_000)) {
    throw new ApiError(429, "Too many messages. Please slow down.");
  }

  const { message } = sendChatMessageSchema.parse(await req.json());

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { currency: true },
  });

  const conversation = await getOrCreateConversation(session.user.id);

  await prisma.aIMessage.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  const history = await prisma.aIMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });

  const assistantText = await getAIProvider().generateToolResponse(
    history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ALL_TOOLS,
    combineExecutors(createFinancialToolExecutor(session.user.id), createCardToolExecutor(session.user.id, user.currency)),
    systemPrompt(user.currency)
  );

  await prisma.aIMessage.create({
    data: { conversationId: conversation.id, role: "assistant", content: assistantText },
  });
  await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  return apiSuccess({ message: assistantText });
});

export const DELETE = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  await prisma.aIConversation.deleteMany({ where: { userId: session.user.id } });
  return apiSuccess({ ok: true });
});
