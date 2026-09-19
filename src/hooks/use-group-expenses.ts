import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";

export interface GroupExpenseShareDTO {
  memberId: string;
  memberName: string;
  amount: string;
  percentage: string | null;
  units: number | null;
}

export interface GroupExpenseDTO {
  id: string;
  description: string;
  amount: string;
  date: string;
  splitType: SplitType;
  category: { id: string; name: string; icon: string; color: string };
  paidBy: { id: string; name: string };
  shares: GroupExpenseShareDTO[];
  createdAt: string;
}

export interface GroupExpenseListResponse {
  expenses: GroupExpenseDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type GroupExpenseInput = {
  description: string;
  amount: string;
  date: string;
  categoryId: string;
  paidByMemberId: string;
} & (
  | { splitType: "EQUAL"; memberIds: string[] }
  | { splitType: "EXACT"; shares: { memberId: string; amount: string }[] }
  | { splitType: "PERCENTAGE"; shares: { memberId: string; percentage: number }[] }
  | { splitType: "SHARES"; shares: { memberId: string; units: number }[] }
);

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

export function useGroupExpenses(groupId: string, page: number) {
  return useQuery({
    queryKey: ["groups", groupId, "expenses", page],
    queryFn: () =>
      fetchJson<GroupExpenseListResponse>(`/api/groups/${groupId}/expenses?page=${page}`),
    enabled: Boolean(groupId),
  });
}

export function useCreateGroupExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GroupExpenseInput) =>
      fetchJson<GroupExpenseDTO>(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    },
  });
}

export function useUpdateGroupExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, input }: { expenseId: string; input: GroupExpenseInput }) =>
      fetchJson<GroupExpenseDTO>(`/api/groups/${groupId}/expenses/${expenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    },
  });
}

export function useDeleteGroupExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) =>
      fetchJson(`/api/groups/${groupId}/expenses/${expenseId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    },
  });
}
