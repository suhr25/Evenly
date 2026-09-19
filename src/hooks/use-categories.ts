import { useQuery } from "@tanstack/react-query";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const res = await fetch("/api/categories");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load categories");
      return body.data;
    },
    staleTime: 5 * 60_000,
  });
}
