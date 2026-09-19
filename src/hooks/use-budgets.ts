import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface BudgetLineItem {
  budgetId: string | null;
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: string | null;
  spent: string;
  remaining: string | null;
  percentUsed: number | null;
  status: "healthy" | "warning" | "exceeded" | "none";
}

export interface MonthBudgetSummary {
  periodStart: string;
  isCurrentMonth: boolean;
  daysRemaining: number | null;
  totalBudgeted: string;
  totalSpent: string;
  items: BudgetLineItem[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

/** Month key in YYYY-MM form. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: () => fetchJson<MonthBudgetSummary>(`/api/budgets?month=${month}`),
  });
}

export function useSetBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { categoryId: string; amount: string; periodStart: string }) =>
      fetchJson("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (budgetId: string) => fetchJson(`/api/budgets/${budgetId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
