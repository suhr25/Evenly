import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface SubscriptionDTO {
  id: string;
  merchant: string;
  displayName: string | null;
  amount: string;
  interval: string;
  annualCost: string;
  occurrenceCount: number;
  firstChargeAt: string;
  lastChargeAt: string;
  status: string;
  isGhost: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => fetchJson<SubscriptionDTO[]>("/api/subscriptions"),
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; status?: string; displayName?: string | null }) =>
      fetchJson<SubscriptionDTO>(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
}
