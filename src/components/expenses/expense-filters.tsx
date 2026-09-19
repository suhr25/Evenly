"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/use-categories";
import type { ExpenseFilters } from "@/hooks/use-expenses";
import { DEFAULT_EXPENSE_FILTERS } from "@/hooks/use-expenses";

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "OTHER", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "date:desc", label: "Newest first" },
  { value: "date:asc", label: "Oldest first" },
  { value: "amount:desc", label: "Amount: high to low" },
  { value: "amount:asc", label: "Amount: low to high" },
  { value: "description:asc", label: "Description: A-Z" },
];

interface ExpenseFiltersBarProps {
  filters: ExpenseFilters;
  onChange: (filters: ExpenseFilters) => void;
}

export function ExpenseFiltersBar({ filters, onChange }: ExpenseFiltersBarProps) {
  const { data: categories } = useCategories();

  const hasActiveFilters =
    filters.search || filters.categoryId || filters.paymentMethod || filters.dateFrom || filters.dateTo;

  function set<K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) {
    onChange({ ...filters, [key]: value, page: 1 });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search expenses…"
            className="pl-8"
            value={filters.search ?? ""}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
        <Select
          items={Object.fromEntries(SORT_OPTIONS.map((o) => [o.value, o.label]))}
          value={`${filters.sortBy}:${filters.sortOrder}`}
          onValueChange={(v) => {
            if (!v) return;
            const [sortBy, sortOrder] = v.split(":") as [ExpenseFilters["sortBy"], ExpenseFilters["sortOrder"]];
            onChange({ ...filters, sortBy, sortOrder, page: 1 });
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={{ all: "All categories", ...Object.fromEntries((categories ?? []).map((c) => [c.id, c.name])) }}
          value={filters.categoryId ?? "all"}
          onValueChange={(v) => set("categoryId", !v || v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={{ all: "All payment methods", ...Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label])) }}
          value={filters.paymentMethod ?? "all"}
          onValueChange={(v) => set("paymentMethod", !v || v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment methods</SelectItem>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-[150px]"
          value={filters.dateFrom ?? ""}
          onChange={(e) => set("dateFrom", e.target.value || undefined)}
          aria-label="From date"
        />
        <Input
          type="date"
          className="w-[150px]"
          value={filters.dateTo ?? ""}
          onChange={(e) => set("dateTo", e.target.value || undefined)}
          aria-label="To date"
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_EXPENSE_FILTERS)}>
            <X className="size-3.5" aria-hidden />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
