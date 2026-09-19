import { addMonths, differenceInCalendarMonths } from "date-fns";
import { Prisma } from "@/generated/prisma/client";
import { toMoney } from "@/lib/money";

export interface SerializedGoal {
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
  recentContributions: { id: string; amount: string; note: string | null; createdAt: string }[];
  createdAt: string;
}

type GoalWithContributions = Prisma.SavingsGoalGetPayload<{
  include: { contributions: true };
}>;

export function serializeGoal(goal: GoalWithContributions): SerializedGoal {
  const target = toMoney(goal.targetAmount.toString());
  const current = toMoney(goal.currentAmount.toString());
  const remaining = target.minus(current).lessThan(0) ? toMoney(0) : target.minus(current);
  const progressPercent = target.isZero()
    ? 100
    : Math.min(100, Math.round(current.dividedBy(target).times(100).toNumber()));

  let requiredMonthlyContribution: string | null = null;
  if (goal.targetDate && !remaining.isZero()) {
    const now = new Date();
    const monthsLeft = Math.max(1, differenceInCalendarMonths(goal.targetDate, now));
    requiredMonthlyContribution = remaining.dividedBy(monthsLeft).toDecimalPlaces(2).toString();
  }

  let expectedCompletionDate: string | null = null;
  if (goal.monthlyContribution && toMoney(goal.monthlyContribution.toString()).greaterThan(0) && !remaining.isZero()) {
    const monthlyAmount = toMoney(goal.monthlyContribution.toString());
    const monthsNeeded = Math.ceil(remaining.dividedBy(monthlyAmount).toNumber());
    expectedCompletionDate = addMonths(new Date(), monthsNeeded).toISOString();
  }

  const sortedContributions = [...goal.contributions].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return {
    id: goal.id,
    name: goal.name,
    icon: goal.icon,
    targetAmount: target.toString(),
    currentAmount: current.toString(),
    targetDate: goal.targetDate?.toISOString() ?? null,
    monthlyContribution: goal.monthlyContribution?.toString() ?? null,
    isCompleted: goal.isCompleted,
    progressPercent,
    remaining: remaining.toString(),
    requiredMonthlyContribution,
    expectedCompletionDate,
    recentContributions: sortedContributions.slice(0, 5).map((c) => ({
      id: c.id,
      amount: toMoney(c.amount.toString()).toString(),
      note: c.note,
      createdAt: c.createdAt.toISOString(),
    })),
    createdAt: goal.createdAt.toISOString(),
  };
}
