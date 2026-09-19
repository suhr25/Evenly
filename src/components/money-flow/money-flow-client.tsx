"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { ExpenseFiltersBar } from "@/components/expenses/expense-filters";
import { ExpenseList } from "@/components/expenses/expense-list";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { DEFAULT_EXPENSE_FILTERS, useExpenses, type ExpenseDTO } from "@/hooks/use-expenses";
import { IncomeFiltersBar } from "@/components/income/income-filters";
import { IncomeList } from "@/components/income/income-list";
import { IncomeFormDialog } from "@/components/income/income-form-dialog";
import { DEFAULT_INCOME_FILTERS, useIncome, type IncomeDTO } from "@/hooks/use-income";
import { PendingImportsCard } from "@/components/money-flow/pending-imports-card";

export function MoneyFlowClient({ currency }: { currency: string }) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "income" ? "income" : "expenses";
  const [tab, setTab] = useState<"expenses" | "income">(initialTab);

  const [expenseFilters, setExpenseFilters] = useState(DEFAULT_EXPENSE_FILTERS);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseDTO | null>(null);
  const { data: expenseData, isLoading: expenseLoading, isFetching: expenseFetching } =
    useExpenses(expenseFilters);

  const [incomeFilters, setIncomeFilters] = useState(DEFAULT_INCOME_FILTERS);
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeDTO | null>(null);
  const { data: incomeData, isLoading: incomeLoading, isFetching: incomeFetching } =
    useIncome(incomeFilters);

  function openCreate() {
    if (tab === "expenses") {
      setEditingExpense(null);
      setExpenseDialogOpen(true);
    } else {
      setEditingIncome(null);
      setIncomeDialogOpen(true);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-16 md:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Money Flow</h1>
          <p className="text-sm text-muted-foreground">
            {tab === "expenses"
              ? expenseData
                ? `${expenseData.total} expense${expenseData.total === 1 ? "" : "s"} tracked`
                : "Loading…"
              : incomeData
                ? `${incomeData.total} entr${incomeData.total === 1 ? "y" : "ies"} tracked`
                : "Loading…"}
          </p>
        </div>
        <Button onClick={openCreate} className="hidden sm:inline-flex">
          <Plus className="size-4" aria-hidden />
          {tab === "expenses" ? "Add expense" : "Add income"}
        </Button>
      </div>

      <PendingImportsCard currency={currency} />

      <Tabs value={tab} onValueChange={(v) => v && setTab(v as "expenses" | "income")}>
        <AnimatedTabs
          aria-label="Money flow view"
          items={[
            { value: "expenses", label: "Expenses" },
            { value: "income", label: "Income" },
          ]}
          value={tab}
          onValueChange={(v) => setTab(v as "expenses" | "income")}
        />

        <TabsContent value="expenses" className="flex flex-col gap-4">
          <ExpenseFiltersBar filters={expenseFilters} onChange={setExpenseFilters} />
          <ExpenseList
            data={expenseData}
            isLoading={expenseLoading || expenseFetching}
            currency={currency}
            onEdit={(expense) => {
              setEditingExpense(expense);
              setExpenseDialogOpen(true);
            }}
            onPageChange={(page) => setExpenseFilters((f) => ({ ...f, page }))}
          />
        </TabsContent>

        <TabsContent value="income" className="flex flex-col gap-4">
          <IncomeFiltersBar filters={incomeFilters} onChange={setIncomeFilters} />
          <IncomeList
            data={incomeData}
            isLoading={incomeLoading || incomeFetching}
            currency={currency}
            onEdit={(income) => {
              setEditingIncome(income);
              setIncomeDialogOpen(true);
            }}
            onPageChange={(page) => setIncomeFilters((f) => ({ ...f, page }))}
          />
        </TabsContent>
      </Tabs>

      <ExpenseFormDialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen} expense={editingExpense} />
      <IncomeFormDialog open={incomeDialogOpen} onOpenChange={setIncomeDialogOpen} income={editingIncome} />

      <Button
        onClick={openCreate}
        size="icon-lg"
        aria-label={tab === "expenses" ? "Add expense" : "Add income"}
        className="fixed bottom-20 right-4 z-40 size-14 rounded-full shadow-lg sm:hidden"
      >
        <Plus className="size-6" aria-hidden />
      </Button>
    </div>
  );
}
