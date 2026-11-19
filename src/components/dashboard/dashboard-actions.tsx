"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { IncomeFormDialog } from "@/components/income/income-form-dialog";

export function DashboardActions() {
  const router = useRouter();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="outline" className="h-10 gap-2 rounded-full border-white/40 bg-transparent px-4 text-sm text-white hover:bg-white/10 hover:text-white" onClick={() => setIncomeOpen(true)}>
          <ArrowDownLeft className="size-3.5" aria-hidden />Add income</Button>
        <Button className="h-10 gap-2 rounded-full bg-[#dcefad] px-4 text-sm text-[#26320e] shadow-sm hover:bg-[#ecfacb]" onClick={() => setExpenseOpen(true)}>
          <Plus className="size-3.5" aria-hidden />Add expense</Button>
      </div>
      {expenseOpen && <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} onSaved={() => router.refresh()} />}
      {incomeOpen && <IncomeFormDialog open={incomeOpen} onOpenChange={setIncomeOpen} onSaved={() => router.refresh()} />}
    </>
  );
}
