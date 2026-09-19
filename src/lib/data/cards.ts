import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-response";
import { addMoney, subtractMoney, toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const cardProductInclude = {
  issuer: true,
  rewardCurrency: true,
  categoryRules: { include: { category: true } },
} satisfies Prisma.CardProductInclude;

export type CardProductWithRelations = Prisma.CardProductGetPayload<{ include: typeof cardProductInclude }>;

export interface SerializedCategoryRule {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  channel: string;
  multiplier: string;
  capAmount: string | null;
  capPeriod: string | null;
  notes: string | null;
}

export interface SerializedCardProduct {
  id: string;
  name: string;
  slug: string;
  issuerName: string;
  network: string;
  variant: string | null;
  joiningFee: string | null;
  annualFee: string;
  annualFeeWaiverSpend: string | null;
  rewardCurrencyName: string | null;
  rewardCurrencyType: string | null;
  rewardCurrencyUnitValueInr: string | null;
  baseRewardRateOnCurrency: string | null;
  foreignTxnFeePercent: string | null;
  loungeAccessDomestic: number | null;
  loungeAccessIntl: number | null;
  milestoneNote: string | null;
  benefitsNote: string | null;
  exclusionsNote: string | null;
  eligibilityNote: string | null;
  isActive: boolean;
  isSeedData: boolean;
  sourceNote: string | null;
  sourceCheckedAt: string | null;
  categoryRules: SerializedCategoryRule[];
  /** Category/channel names where this card earns above its own base rate. Derived from
   * categoryRules, never hardcoded, so a new seeded card gets this "for free". */
  bestUsedFor: string[];
}

/** Pure and separately unit-tested: which categories/channels this card earns above its
 * own base rate, derived purely from seeded rule data. Never a hardcoded per-card string. */
export function deriveBestUsedFor(categoryRules: SerializedCategoryRule[]): string[] {
  return categoryRules
    .filter((r) => Number(r.multiplier) > 1)
    .sort((a, b) => Number(b.multiplier) - Number(a.multiplier))
    .map((r) => {
      const label = r.categoryName ?? "General spend";
      return r.channel === "ANY" ? label : `${label} (${r.channel.toLowerCase()})`;
    });
}

export function serializeCardProduct(product: CardProductWithRelations): SerializedCardProduct {
  const categoryRules = product.categoryRules.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    channel: r.channel,
    multiplier: r.multiplier.toString(),
    capAmount: r.capAmount ? toMoney(r.capAmount).toString() : null,
    capPeriod: r.capPeriod,
    notes: r.notes,
  }));

  const bestUsedFor = deriveBestUsedFor(categoryRules);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    issuerName: product.issuer.name,
    network: product.network,
    variant: product.variant,
    joiningFee: product.joiningFee ? toMoney(product.joiningFee).toString() : null,
    annualFee: toMoney(product.annualFee).toString(),
    annualFeeWaiverSpend: product.annualFeeWaiverSpend
      ? toMoney(product.annualFeeWaiverSpend).toString()
      : null,
    rewardCurrencyName: product.rewardCurrency?.name ?? null,
    rewardCurrencyType: product.rewardCurrency?.type ?? null,
    rewardCurrencyUnitValueInr: product.rewardCurrency
      ? product.rewardCurrency.unitValueInr.toString()
      : null,
    baseRewardRateOnCurrency: product.baseRewardRateOnCurrency?.toString() ?? null,
    foreignTxnFeePercent: product.foreignTxnFeePercent?.toString() ?? null,
    loungeAccessDomestic: product.loungeAccessDomestic,
    loungeAccessIntl: product.loungeAccessIntl,
    milestoneNote: product.milestoneNote,
    benefitsNote: product.benefitsNote,
    exclusionsNote: product.exclusionsNote,
    eligibilityNote: product.eligibilityNote,
    isActive: product.isActive,
    isSeedData: product.isSeedData,
    sourceNote: product.sourceNote,
    sourceCheckedAt: product.sourceCheckedAt?.toISOString() ?? null,
    categoryRules,
    bestUsedFor,
  };
}

/** Search the card-product catalog for the Add Card search-then-select flow. Search is
 * intentionally catalog-wide (not scoped to ownership). This same query backs both the
 * "add a card I own" flow and Discover Mode's browsing later; ownership filtering happens
 * at the call site, never baked into this query. */
export async function listCardProducts(search?: string): Promise<SerializedCardProduct[]> {
  const products = await prisma.cardProduct.findMany({
    where: search
      ? {
          isActive: true,
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { variant: { contains: search, mode: "insensitive" } },
            { issuer: { name: { contains: search, mode: "insensitive" } } },
            { issuer: { shortCode: { contains: search, mode: "insensitive" } } },
          ],
        }
      : { isActive: true },
    include: cardProductInclude,
    orderBy: [{ issuer: { name: "asc" } }, { name: "asc" }],
  });
  return products.map(serializeCardProduct);
}

export async function getCardProductDetail(id: string): Promise<SerializedCardProduct> {
  const product = await prisma.cardProduct.findUnique({ where: { id }, include: cardProductInclude });
  if (!product) throw new ApiError(404, "Card not found in the catalog.");
  return serializeCardProduct(product);
}

export interface SerializedUserCard {
  id: string;
  nickname: string | null;
  lastFourDigits: string | null;
  creditLimit: string | null;
  outstanding: string | null;
  availableCredit: string | null;
  utilizationPercent: number | null;
  rewardBalance: string | null;
  statementDate: number | null;
  paymentDueDate: number | null;
  status: string;
  creditLimitSource: string;
  outstandingSource: string;
  rewardBalanceSource: string;
  lastSyncedAt: string | null;
  createdAt: string;
  cardProduct: SerializedCardProduct;
}

const userCardInclude = {
  cardProduct: { include: cardProductInclude },
} satisfies Prisma.UserCardInclude;

export type UserCardWithRelations = Prisma.UserCardGetPayload<{ include: typeof userCardInclude }>;

export function computeUtilizationPercent(creditLimit: string | null, outstanding: string | null): number | null {
  if (!creditLimit || Number(creditLimit) <= 0) return null;
  const pct = (Number(outstanding ?? "0") / Number(creditLimit)) * 100;
  return Math.round(pct * 100) / 100;
}

export function serializeUserCard(card: UserCardWithRelations): SerializedUserCard {
  const creditLimit = card.creditLimit ? toMoney(card.creditLimit).toString() : null;
  const outstanding = card.outstanding ? toMoney(card.outstanding).toString() : null;
  const availableCredit =
    creditLimit !== null ? subtractMoney(creditLimit, outstanding ?? "0").toString() : null;

  return {
    id: card.id,
    nickname: card.nickname,
    lastFourDigits: card.lastFourDigits,
    creditLimit,
    outstanding,
    availableCredit,
    utilizationPercent: computeUtilizationPercent(creditLimit, outstanding),
    rewardBalance: card.rewardBalance ? card.rewardBalance.toString() : null,
    statementDate: card.statementDate,
    paymentDueDate: card.paymentDueDate,
    status: card.status,
    creditLimitSource: card.creditLimitSource,
    outstandingSource: card.outstandingSource,
    rewardBalanceSource: card.rewardBalanceSource,
    lastSyncedAt: card.lastSyncedAt?.toISOString() ?? null,
    createdAt: card.createdAt.toISOString(),
    cardProduct: serializeCardProduct(card.cardProduct),
  };
}

export interface PortfolioSummary {
  totalCreditLimit: string;
  totalOutstanding: string;
  overallUtilizationPercent: number | null;
}

export function computePortfolioSummary(cards: SerializedUserCard[]): PortfolioSummary {
  const totalCreditLimit = addMoney(...cards.map((c) => c.creditLimit ?? "0")).toString();
  const totalOutstanding = addMoney(...cards.map((c) => c.outstanding ?? "0")).toString();
  return {
    totalCreditLimit,
    totalOutstanding,
    overallUtilizationPercent: computeUtilizationPercent(totalCreditLimit, totalOutstanding),
  };
}

/** Portfolio Mode: the only cards this user owns. This is the single choke point every
 * recommendation-facing query must go through. Nothing here can return a card the user
 * does not have a UserCard row for. */
export async function listUserCards(userId: string): Promise<SerializedUserCard[]> {
  const cards = await listOwnedUserCardsRaw(userId);
  return cards.map(serializeUserCard);
}

/** Same portfolio-only query as listUserCards, without the serialization step. For callers
 * (like Phase 5's recommendation engine) that need the raw Decimal fields to run further
 * calculations rather than display-ready strings. */
export async function listOwnedUserCardsRaw(userId: string): Promise<UserCardWithRelations[]> {
  return prisma.userCard.findMany({
    where: { userId, status: "ACTIVE" },
    include: userCardInclude,
    orderBy: { createdAt: "asc" },
  });
}

export async function getOwnedUserCard(userId: string, id: string): Promise<UserCardWithRelations> {
  const card = await prisma.userCard.findUnique({ where: { id }, include: userCardInclude });
  if (!card || card.userId !== userId) {
    throw new ApiError(404, "Card not found in your portfolio.");
  }
  return card;
}
