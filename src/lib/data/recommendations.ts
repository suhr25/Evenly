import { ApiError } from "@/lib/api-response";
import { toMoney } from "@/lib/money";
import { rankCardCandidates, type CardCandidate, type RewardChannel } from "@/lib/rewards";
import { computeUtilizationPercent, listOwnedUserCardsRaw, serializeCardProduct } from "@/lib/data/cards";
import { estimateRewardForUserCardRecord } from "@/lib/data/reward-estimates";

export interface RecommendationTransactionInput {
  amount: string;
  categoryId: string | null;
  channel: RewardChannel;
}

export interface SerializedRankedCandidate {
  userCardId: string;
  cardLabel: string;
  estimatedValueInr: string;
  rewardUnits: number;
  utilizationAfterPercent: number | null;
  reasons: string[];
}

export interface SerializedRecommendation {
  best: SerializedRankedCandidate;
  alternatives: SerializedRankedCandidate[];
}

/**
 * Phase 5: the actual "which of my cards should I use" recommendation, Portfolio Mode only.
 * Every candidate here comes from listOwnedUserCardsRaw, which is scoped to this user's own
 * UserCard rows; there is no code path in this function that can introduce a card the user
 * doesn't own. Discovery Mode (comparing against cards the user doesn't have) is an explicit,
 * separate feature. Never blended into this one.
 */
export async function recommendBestCard(
  userId: string,
  input: RecommendationTransactionInput
): Promise<SerializedRecommendation> {
  const ownedCards = await listOwnedUserCardsRaw(userId);
  if (ownedCards.length === 0) {
    throw new ApiError(400, "Add at least one card to your portfolio to get a recommendation.");
  }

  const candidates: CardCandidate[] = await Promise.all(
    ownedCards.map(async (userCard) => {
      const estimate = await estimateRewardForUserCardRecord(userCard, {
        amount: input.amount,
        categoryId: input.categoryId,
        channel: input.channel,
      });

      const creditLimit = userCard.creditLimit ? toMoney(userCard.creditLimit).toString() : null;
      const outstandingAfter = userCard.outstanding
        ? toMoney(userCard.outstanding).plus(toMoney(input.amount)).toString()
        : toMoney(input.amount).toString();
      const utilizationAfterPercent = computeUtilizationPercent(creditLimit, outstandingAfter);

      const product = serializeCardProduct(userCard.cardProduct);
      const cardLabel = userCard.nickname || `${product.issuerName} ${product.name}`;

      return { userCardId: userCard.id, cardLabel, estimate, utilizationAfterPercent };
    })
  );

  const ranked = rankCardCandidates(candidates);

  const serialize = (c: (typeof ranked)["best"]): SerializedRankedCandidate => ({
    userCardId: c.userCardId,
    cardLabel: c.cardLabel,
    estimatedValueInr: toMoney(c.estimate.cappedValueInr.toFixed(2)).toString(),
    rewardUnits: Math.round(c.estimate.rewardUnits * 100) / 100,
    utilizationAfterPercent: c.utilizationAfterPercent,
    reasons: c.reasons,
  });

  return {
    best: serialize(ranked.best),
    alternatives: ranked.alternatives.map(serialize),
  };
}
