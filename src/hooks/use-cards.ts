import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CardProductDTO } from "@/hooks/use-card-products";

export interface UserCardDTO {
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
  cardProduct: CardProductDTO;
}

export interface UserCardInput {
  cardProductId?: string;
  nickname?: string | null;
  lastFourDigits?: string | null;
  creditLimit?: string | null;
  outstanding?: string | null;
  rewardBalance?: string | null;
  statementDate?: number | null;
  paymentDueDate?: number | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

/** Portfolio Mode: the cards this signed-in user owns. Every "which card should I use"
 * surface must source its options from this hook (or the equivalent server call). Never
 * from the card-product catalog directly. */
export function useMyCards() {
  return useQuery({
    queryKey: ["cards"],
    queryFn: () => fetchJson<UserCardDTO[]>("/api/cards"),
  });
}

export function useMyCard(id: string) {
  return useQuery({
    queryKey: ["cards", id],
    queryFn: () => fetchJson<UserCardDTO>(`/api/cards/${id}`),
    enabled: Boolean(id),
  });
}

export function useAddCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UserCardInput) =>
      fetchJson<UserCardDTO>("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
  });
}

export function useUpdateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserCardInput }) =>
      fetchJson<UserCardDTO>(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["cards", id] });
    },
  });
}

export function useRemoveCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/cards/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
  });
}
