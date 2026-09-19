"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { AddFundsDialog } from "@/components/goals/add-funds-dialog";
import { useGoals, type GoalDTO } from "@/hooks/use-goals";

export function GoalsClient({ currency }: { currency: string }) {
  const { data: goals, isLoading } = useGoals();
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalDTO | null>(null);
  const [fundsGoal, setFundsGoal] = useState<GoalDTO | null>(null);
  const [fundsOpen, setFundsOpen] = useState(false);

  function openCreate() {
    setEditingGoal(null);
    setFormOpen(true);
  }

  function openEdit(goal: GoalDTO) {
    setEditingGoal(goal);
    setFormOpen(true);
  }

  function openAddFunds(goal: GoalDTO) {
    setFundsGoal(goal);
    setFundsOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Savings goals</h1>
          <p className="text-sm text-muted-foreground">Save toward something specific and track your progress.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New goal
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : !goals || goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-20 text-center">
          <Target className="size-10 text-muted-foreground/50" aria-hidden />
          <div>
            <p className="font-medium">No savings goals yet</p>
            <p className="text-sm text-muted-foreground">
              Set a target for a bike, a trip, an emergency fund, anything.
            </p>
          </div>
          <Button className="mt-2" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Create your first goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              currency={currency}
              onEdit={() => openEdit(goal)}
              onAddFunds={() => openAddFunds(goal)}
            />
          ))}
        </div>
      )}

      <GoalFormDialog open={formOpen} onOpenChange={setFormOpen} goal={editingGoal} />
      <AddFundsDialog goal={fundsGoal} open={fundsOpen} onOpenChange={setFundsOpen} />
    </div>
  );
}
