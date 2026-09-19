import { useMutation, useQuery } from "@tanstack/react-query";
import type { CardProductDTO } from "@/hooks/use-card-products";

export interface DiscoveryCandidateDTO {
  cardProductId: string;
  cardLabel: string;
  estimatedValueInr: string;
  reasons: string[];
}

/** Discovery Mode: browses cards the signed-in user does NOT own. Never used by any
 * Portfolio Mode surface (My Cards, Best Card). Kept as a separate hook on purpose so the
 * two modes can never accidentally share a query cache key or code path. */
export function useDiscoverableCards(search: string) {
  return useQuery({
    queryKey: ["discovery", "cards", search],
    queryFn: async (): Promise<CardProductDTO[]> => {
      const res = await fetch(`/api/discovery/cards?search=${encodeURIComponent(search)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load cards");
      return body.data;
    },
  });
}

export interface DiscoveryRecommendInput {
  amount: string;
  categoryId: string | null;
  channel: "ONLINE" | "OFFLINE";
}

export function useDiscoveryRecommendation() {
  return useMutation({
    mutationFn: async (input: DiscoveryRecommendInput): Promise<DiscoveryCandidateDTO[]> => {
      const res = await fetch("/api/discovery/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to get a recommendation");
      return body.data.top;
    },
  });
}
