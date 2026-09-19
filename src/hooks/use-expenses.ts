import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ExpenseDTO {
  id: string;
  amount: string;
  description: string;
  date: string;
  paymentMethod: string;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  notes: string | null;
  category: { id: string; name: string; icon: string; color: string };
  userCard: { id: string; label: string } | null;
  isOnline: boolean | null;
  group: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResponse {
  expenses: ExpenseDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExpenseFilters {
  search?: string;
  categoryId?: string;
  userCardId?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy: "date" | "amount" | "description";
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
}

export const DEFAULT_EXPENSE_FILTERS: ExpenseFilters = {
  sortBy: "date",
  sortOrder: "desc",
  page: 1,
  pageSize: 20,
};

export interface ExpenseInput {
  amount: string;
  categoryId: string;
  userCardId?: string | null;
  isOnline?: boolean | null;
  description: string;
  date: string;
  paymentMethod: string;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  notes?: string | null;
}

function buildQueryString(filters: ExpenseFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== null) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export function useExpenses(filters: ExpenseFilters) {
  return useQuery({
    queryKey: ["expenses", filters],
    queryFn: async (): Promise<ExpenseListResponse> => {
      const res = await fetch(`/api/expenses?${buildQueryString(filters)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load expenses");
      return body.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create expense");
      return body.data as ExpenseDTO;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ExpenseInput }) => {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update expense");
      return body.data as ExpenseDTO;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to delete expense");
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}
