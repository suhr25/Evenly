import { useQuery } from "@tanstack/react-query";

export interface CategoryRuleDTO {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  channel: string;
  multiplier: string;
  capAmount: string | null;
  capPeriod: string | null;
  notes: string | null;
}

export interface CardProductDTO {
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
  categoryRules: CategoryRuleDTO[];
  bestUsedFor: string[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

/** Card catalog search for the Add Card flow. */
export function useCardProductSearch(search: string) {
  return useQuery({
    queryKey: ["card-products", search],
    queryFn: () => fetchJson<CardProductDTO[]>(`/api/card-products?search=${encodeURIComponent(search)}`),
  });
}

export function useCardProduct(id: string | null) {
  return useQuery({
    queryKey: ["card-products", "detail", id],
    queryFn: () => fetchJson<CardProductDTO>(`/api/card-products/${id}`),
    enabled: Boolean(id),
  });
}
