import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface PendingImportDTO {
  id: string;
  direction: "DEBIT" | "CREDIT";
  amount: string;
  merchant: string | null;
  bankName: string | null;
  lastFourDigits: string | null;
  occurredAt: string;
  rawSnippet: string;
  createdAt: string;
}

export interface ConfirmPendingImportInput {
  as: "expense" | "income";
  categoryId?: string | null;
  paymentMethod?: string | null;
  description?: string | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

export function usePendingImports() {
  return useQuery({
    queryKey: ["pending-imports"],
    queryFn: () => fetchJson<{ imports: PendingImportDTO[] }>("/api/pending-imports"),
  });
}

/**
 * An imported transaction becomes a real Expense/Income, which feeds the
 * budgets, the dashboard totals, the spending charts and the AI insights.
 * The client-side caches are invalidated here, and router.refresh() re-runs
 * the server components (dashboard, insights) that React Query never sees -
 * without it those pages keep serving pre-import numbers until a hard reload.
 */
function useImportPropagation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return () => {
    for (const key of [
      ["pending-imports"],
      ["expenses"],
      ["income"],
      ["budgets"],
      ["goals"],
      ["cards"],
      ["subscriptions"],
    ]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
    router.refresh();
  };
}

export function useConfirmPendingImport() {
  const propagate = useImportPropagation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmPendingImportInput }) =>
      fetchJson(`/api/pending-imports/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: propagate,
  });
}

export function useConfirmAllPendingImports() {
  const propagate = useImportPropagation();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ expenses: number; income: number; failed: number }>(
        "/api/pending-imports/confirm-all",
        { method: "POST" }
      ),
    onSuccess: propagate,
  });
}

export function useDismissPendingImport() {
  const propagate = useImportPropagation();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/pending-imports/${id}`, { method: "DELETE" }),
    onSuccess: propagate,
  });
}
