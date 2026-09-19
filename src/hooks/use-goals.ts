import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface GoalContributionDTO {
  id: string;
  amount: string;
  note: string | null;
  createdAt: string;
}

export interface GoalDTO {
  id: string;
  name: string;
  icon: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
  monthlyContribution: string | null;
  isCompleted: boolean;
  progressPercent: number;
  remaining: string;
  requiredMonthlyContribution: string | null;
  expectedCompletionDate: string | null;
  recentContributions: GoalContributionDTO[];
  createdAt: string;
}

export interface GoalInput {
  name: string;
  icon: string;
  targetAmount: string;
  currentAmount?: string;
  targetDate?: string | null;
  monthlyContribution?: string | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: () => fetchJson<GoalDTO[]>("/api/goals"),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GoalInput) =>
      fetchJson<GoalDTO>("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: GoalInput }) =>
      fetchJson<GoalDTO>(`/api/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useAddContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: string; note?: string }) =>
      fetchJson<GoalDTO>(`/api/goals/${id}/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}
