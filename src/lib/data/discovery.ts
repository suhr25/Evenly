import { prisma } from "@/lib/prisma";
import {
  cardProductInclude,
  serializeCardProduct,
  type CardProductWithRelations,
  type SerializedCardProduct,
} from "@/lib/data/cards";
import { buildRewardProfile } from "@/lib/data/reward-estimates";
import { estimateReward, rankCardCandidates, type CardCandidate, type RewardChannel } from "@/lib/rewards";

async function ownedCardProductIds(userId: string): Promise<string[]> {
  const owned = await prisma.userCard.findMany({ where: { userId }, select: { cardProductId: true } });
  return owned.map((o) => o.cardProductId);
}

/**
 * Discovery Mode: catalog products this user does NOT already own. This is the only function
 * in the codebase that is allowed to return a card the signed-in user doesn't have. It exists
 * specifically so that fact is grep-able and auditable, rather than a boolean flag buried
 * inside the portfolio query that a future edit could silently flip. Nothing in Portfolio Mode
 * (My Cards, Best Card) ever imports from this file.
 */
export async function listDiscoverableCardProducts(userId: string, search?: string): Promise<SerializedCardProduct[]> {
  const ownedIds = await ownedCardProductIds(userId);

  const products = await prisma.cardProduct.findMany({
    where: {
      isActive: true,
      id: { notIn: ownedIds },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { variant: { contains: search, mode: "insensitive" as const } },
              { issuer: { name: { contains: search, mode: "insensitive" as const } } },
              { issuer: { shortCode: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: cardProductInclude,
    orderBy: [{ issuer: { name: "asc" } }, { name: "asc" }],
  });
  return products.map(serializeCardProduct);
}

async function listDiscoverableProductsRaw(userId: string): Promise<CardProductWithRelations[]> {
  const ownedIds = await ownedCardProductIds(userId);
  return prisma.cardProduct.findMany({
    where: { isActive: true, id: { notIn: ownedIds } },
    include: cardProductInclude,
  });
}

export interface DiscoveryRecommendationInput {
  amount: string;
  categoryId: string | null;
  channel: RewardChannel;
}

export interface SerializedDiscoveryCandidate {
  cardProductId: string;
  cardLabel: string;
  estimatedValueInr: string;
  reasons: string[];
}

/**
 * Ranks the DISCOVERABLE catalog. Cards this user doesn't own. For a hypothetical
 * transaction (e.g. "recommend a new travel card"). No cap-accrual history or utilization
 * factors in, since there's no account history on a card that doesn't exist yet; this is
 * disclosed explicitly in the reasons rather than presented as a confident final number.
 * Based on the information provided in this catalog. Never claimed as universally "best."
 */
export async function recommendDiscoveryCard(
  userId: string,
  input: DiscoveryRecommendationInput,
  limit = 5
): Promise<SerializedDiscoveryCandidate[]> {
  const discoverable = await listDiscoverableProductsRaw(userId);
  if (discoverable.length === 0) return [];

  const candidates: CardCandidate[] = discoverable.map((product) => {
    const profile = buildRewardProfile(product);
    const estimate = estimateReward(
      profile,
      { amount: input.amount, categoryId: input.categoryId, channel: input.channel },
      0
    );
    return {
      userCardId: product.id,
      cardLabel: `${product.issuer.name} ${product.name}`,
      estimate,
      utilizationAfterPercent: null,
    };
  });

  const ranked = rankCardCandidates(candidates);
  const ordered = [ranked.best, ...ranked.alternatives].slice(0, limit);

  return ordered.map((c) => ({
    cardProductId: c.userCardId,
    cardLabel: c.cardLabel,
    estimatedValueInr: c.estimate.cappedValueInr.toFixed(2),
    reasons: [
      ...c.reasons,
      "This is a first-transaction estimate for a card you don't currently own. Based on the catalog information available, and not a guarantee of actual terms once issued.",
    ],
  }));
}

export interface ComparisonCard {
  cardProductId: string;
  owned: boolean;
  product: SerializedCardProduct;
}

/** Compares any mix of owned and not-owned cards side by side, explicitly labeling which is
 * which. A user must never come away thinking an unowned card is already in their wallet. */
export async function compareCards(userId: string, cardProductIds: string[]): Promise<ComparisonCard[]> {
  const [ownedRows, products] = await Promise.all([
    prisma.userCard.findMany({
      where: { userId, cardProductId: { in: cardProductIds } },
      select: { cardProductId: true },
    }),
    prisma.cardProduct.findMany({ where: { id: { in: cardProductIds } }, include: cardProductInclude }),
  ]);
  const ownedSet = new Set(ownedRows.map((o) => o.cardProductId));
  const byId = new Map(products.map((p) => [p.id, p]));

  return cardProductIds
    .map((id) => byId.get(id))
    .filter((p): p is CardProductWithRelations => Boolean(p))
    .map((p) => ({ cardProductId: p.id, owned: ownedSet.has(p.id), product: serializeCardProduct(p) }));
}
