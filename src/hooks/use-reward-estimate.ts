import { useQuery } from "@tanstack/react-query";

export interface RewardEstimateDTO {
  rule: { id: string; categoryId: string | null; channel: string; multiplier: string } | null;
  multiplier: number;
  rewardUnits: number;
  rewardValueInr: number;
  cappedValueInr: number;
  capApplied: boolean;
  capRemainingBeforeInr: number | null;
  reasons: string[];
}

interface EstimateRewardInput {
  userCardId: string | null;
  amount: string;
  categoryId: string | null;
  channel: "ONLINE" | "OFFLINE";
}

/** Phase 4: live estimated reward value for a single card + transaction, used as an inline
 * hint while logging an expense. Disabled until a card, category, and a positive amount are
 * all chosen, so it never fires speculative requests mid-typing. */
export function useRewardEstimate({ userCardId, amount, categoryId, channel }: EstimateRewardInput) {
  const enabled = Boolean(userCardId && categoryId && Number(amount) > 0);

  return useQuery({
    queryKey: ["reward-estimate", userCardId, amount, categoryId, channel],
    queryFn: async (): Promise<RewardEstimateDTO> => {
      const params = new URLSearchParams({ amount, channel });
      if (categoryId) params.set("categoryId", categoryId);
      const res = await fetch(`/api/cards/${userCardId}/estimate-reward?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to estimate reward");
      return body.data;
    },
    enabled,
  });
}
