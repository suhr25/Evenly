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
import type { IncomeFilters } from "@/hooks/use-income";
import { DEFAULT_INCOME_FILTERS } from "@/hooks/use-income";

const SORT_OPTIONS = [
  { value: "date:desc", label: "Newest first" },
  { value: "date:asc", label: "Oldest first" },
  { value: "amount:desc", label: "Amount: high to low" },
  { value: "amount:asc", label: "Amount: low to high" },
  { value: "source:asc", label: "Source: A-Z" },
];

interface IncomeFiltersBarProps {
  filters: IncomeFilters;
  onChange: (filters: IncomeFilters) => void;
}

export function IncomeFiltersBar({ filters, onChange }: IncomeFiltersBarProps) {
  const hasActiveFilters = filters.search || filters.dateFrom || filters.dateTo;

  function set<K extends keyof IncomeFilters>(key: K, value: IncomeFilters[K]) {
    onChange({ ...filters, [key]: value, page: 1 });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search income…"
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
            const [sortBy, sortOrder] = v.split(":") as [IncomeFilters["sortBy"], IncomeFilters["sortOrder"]];
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
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_INCOME_FILTERS)}>
            <X className="size-3.5" aria-hidden />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
