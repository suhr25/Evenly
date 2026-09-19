import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface IncomeDTO {
  id: string;
  amount: string;
  source: string;
  date: string;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  createdAt: string;
}

export interface IncomeListResponse {
  income: IncomeDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IncomeFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy: "date" | "amount" | "source";
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
}

export const DEFAULT_INCOME_FILTERS: IncomeFilters = {
  sortBy: "date",
  sortOrder: "desc",
  page: 1,
  pageSize: 20,
};

export interface IncomeInput {
  amount: string;
  source: string;
  date: string;
  isRecurring: boolean;
  recurrenceInterval: string | null;
}

function buildQueryString(filters: IncomeFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== null) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export function useIncome(filters: IncomeFilters) {
  return useQuery({
    queryKey: ["income", filters],
    queryFn: async (): Promise<IncomeListResponse> => {
      const res = await fetch(`/api/income?${buildQueryString(filters)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load income");
      return body.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: IncomeInput) => {
      const res = await fetch("/api/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add income");
      return body.data as IncomeDTO;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
    },
  });
}

export function useUpdateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: IncomeInput }) => {
      const res = await fetch(`/api/income/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update income");
      return body.data as IncomeDTO;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
    },
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/income/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to delete income");
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
    },
  });
}
