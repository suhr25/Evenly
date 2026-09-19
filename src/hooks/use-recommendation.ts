import { useMutation } from "@tanstack/react-query";

export interface RankedCardDTO {
  userCardId: string;
  cardLabel: string;
  estimatedValueInr: string;
  rewardUnits: number;
  utilizationAfterPercent: number | null;
  reasons: string[];
}

export interface RecommendationDTO {
  best: RankedCardDTO;
  alternatives: RankedCardDTO[];
}

export interface RecommendationInput {
  amount: string;
  categoryId: string | null;
  channel: "ONLINE" | "OFFLINE";
}

/** Portfolio Mode only. This always calls /api/recommendations, which only ever ranks the
 * signed-in user's own owned cards. There is no client-side path to a Discovery-mode result
 * through this hook. */
export function useRecommendation() {
  return useMutation({
    mutationFn: async (input: RecommendationInput): Promise<RecommendationDTO> => {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to get a recommendation");
      return body.data;
    },
  });
}
