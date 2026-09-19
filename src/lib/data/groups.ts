import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-response";
import {
  addMoney,
  Decimal,
  splitByPercentage,
  splitByShares,
  splitEqual,
  subtractMoney,
  toMoney,
  validateExactSplit,
} from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { CreateGroupExpenseInput } from "@/lib/validations/group";

export async function requireGroupMembership(userId: string, groupId: string) {
  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId, isActive: true },
  });
  if (!member) {
    throw new ApiError(404, "Group not found.");
  }
  return member;
}

export interface ComputedShare {
  memberId: string;
  shareAmount: string;
  sharePercentage: string | null;
  shareUnits: number | null;
}

/** Recomputes canonical per-member shares server-side. Client-submitted
 * amounts for EQUAL/PERCENTAGE/SHARES splits are never trusted directly. */
export function computeShares(input: CreateGroupExpenseInput): ComputedShare[] {
  if (input.splitType === "EQUAL") {
    const memberIds = [...input.memberIds].sort();
    const amounts = splitEqual(input.amount, memberIds.length);
    return memberIds.map((memberId, i) => ({
      memberId,
      shareAmount: amounts[i].toString(),
      sharePercentage: null,
      shareUnits: null,
    }));
  }

  if (input.splitType === "EXACT") {
    const amounts = input.shares.map((s) => s.amount);
    if (!validateExactSplit(input.amount, amounts)) {
      throw new ApiError(400, "The exact amounts must add up to the total expense amount.");
    }
    return input.shares.map((s) => ({
      memberId: s.memberId,
      shareAmount: toMoney(s.amount).toString(),
      sharePercentage: null,
      shareUnits: null,
    }));
  }

  if (input.splitType === "PERCENTAGE") {
    let amounts: Decimal[];
    try {
      amounts = splitByPercentage(
        input.amount,
        input.shares.map((s) => s.percentage)
      );
    } catch {
      throw new ApiError(400, "Percentages must add up to 100.");
    }
    return input.shares.map((s, i) => ({
      memberId: s.memberId,
      shareAmount: amounts[i].toString(),
      sharePercentage: s.percentage.toFixed(2),
      shareUnits: null,
    }));
  }

  // SHARES
  const amounts = splitByShares(
    input.amount,
    input.shares.map((s) => s.units)
  );
  return input.shares.map((s, i) => ({
    memberId: s.memberId,
    shareAmount: amounts[i].toString(),
    sharePercentage: null,
    shareUnits: s.units,
  }));
}

export interface MemberBalance {
  memberId: string;
  name: string;
  userId: string | null;
  isActive: boolean;
  netBalance: string; // positive = is owed money by the group, negative = owes the group
}

export async function computeGroupBalances(groupId: string): Promise<MemberBalance[]> {
  const [members, paidAgg, owedAgg, sentAgg, receivedAgg] = await Promise.all([
    prisma.groupMember.findMany({ where: { groupId } }),
    prisma.groupExpense.groupBy({
      by: ["paidByMemberId"],
      where: { groupId },
      _sum: { amount: true },
    }),
    prisma.groupExpenseShare.groupBy({
      by: ["groupMemberId"],
      where: { groupExpense: { groupId } },
      _sum: { shareAmount: true },
    }),
    prisma.settlement.groupBy({
      by: ["fromMemberId"],
      where: { groupId },
      _sum: { amount: true },
    }),
    prisma.settlement.groupBy({
      by: ["toMemberId"],
      where: { groupId },
      _sum: { amount: true },
    }),
  ]);

  return members.map((m) => {
    const paid = paidAgg.find((p) => p.paidByMemberId === m.id)?._sum.amount?.toString() ?? "0";
    const owed = owedAgg.find((o) => o.groupMemberId === m.id)?._sum.shareAmount?.toString() ?? "0";
    const sent = sentAgg.find((s) => s.fromMemberId === m.id)?._sum.amount?.toString() ?? "0";
    const received = receivedAgg.find((s) => s.toMemberId === m.id)?._sum.amount?.toString() ?? "0";

    const credit = addMoney(paid, sent);
    const debit = addMoney(owed, received);

    return {
      memberId: m.id,
      name: m.name,
      userId: m.userId,
      isActive: m.isActive,
      netBalance: subtractMoney(credit, debit).toString(),
    };
  });
}

export async function assertMemberBalanceIsZero(groupId: string, memberId: string) {
  const balances = await computeGroupBalances(groupId);
  const balance = balances.find((b) => b.memberId === memberId);
  if (balance && !toMoney(balance.netBalance).isZero()) {
    throw new ApiError(
      400,
      "This member still has an outstanding balance. Settle up before removing them."
    );
  }
}

export function serializeGroupExpense(
  expense: Prisma.GroupExpenseGetPayload<{
    include: { category: true; paidBy: true; shares: { include: { groupMember: true } } };
  }>
) {
  return {
    id: expense.id,
    description: expense.description,
    amount: toMoney(expense.amount.toString()).toString(),
    date: expense.date.toISOString(),
    splitType: expense.splitType,
    category: {
      id: expense.category.id,
      name: expense.category.name,
      icon: expense.category.icon,
      color: expense.category.color,
    },
    paidBy: { id: expense.paidBy.id, name: expense.paidBy.name },
    shares: expense.shares.map((s) => ({
      memberId: s.groupMemberId,
      memberName: s.groupMember.name,
      amount: toMoney(s.shareAmount.toString()).toString(),
      percentage: s.sharePercentage?.toString() ?? null,
      units: s.shareUnits,
    })),
    createdAt: expense.createdAt.toISOString(),
  };
}

/**
 * Keeps each participating member's *own share* of a group expense mirrored into their
 * personal Money Flow/Budgets. Never the full amount someone fronted. This is the only
 * economically correct sync: your real cost for a split flight is your share, not the total
 * you paid on your friends' behalf, and not double-counted for both payer and participants.
 * Call after every group expense create/update; safe to call repeatedly (idempotent upsert
 * keyed on groupExpenseId+userId), and cleans up shares for members who dropped out of the
 * split since the last sync.
 */
export async function syncGroupExpenseToPersonalExpenses(groupExpenseId: string) {
  const expense = await prisma.groupExpense.findUnique({
    where: { id: groupExpenseId },
    include: {
      group: { select: { name: true } },
      shares: { include: { groupMember: { select: { userId: true, name: true } } } },
    },
  });
  if (!expense) return;

  const linkedShares = expense.shares.filter(
    (s): s is typeof s & { groupMember: { userId: string; name: string } } => s.groupMember.userId !== null
  );
  const currentUserIds = new Set(linkedShares.map((s) => s.groupMember.userId));

  await Promise.all(
    linkedShares.map((share) =>
      prisma.expense.upsert({
        where: { groupExpenseId_userId: { groupExpenseId, userId: share.groupMember.userId } },
        update: {
          categoryId: expense.categoryId,
          amount: share.shareAmount,
          description: expense.description,
          date: expense.date,
        },
        create: {
          userId: share.groupMember.userId,
          categoryId: expense.categoryId,
          groupExpenseId,
          amount: share.shareAmount,
          description: expense.description,
          date: expense.date,
          paymentMethod: "OTHER",
          notes: `Your share of a group expense in "${expense.group.name}".`,
        },
      })
    )
  );

  // Drop synced expenses for members no longer in the split (e.g. removed, or split edited
  // to exclude them). This row has no independent meaning once they're not a participant.
  await prisma.expense.deleteMany({
    where: {
      groupExpenseId,
      userId: { notIn: [...currentUserIds] },
    },
  });
}

/**
 * Mirrors a group settlement received by a linked Evenly account as personal income. Only
 * fires for the receiving side. The amount was never recorded as that member's expense (only
 * their own share was, via syncGroupExpenseToPersonalExpenses), so this is real incoming cash,
 * not a correction of an overstated expense. The paying side gets nothing here: their cost was
 * already recognized as an expense when the group expense itself was created.
 */
export async function syncSettlementToIncome(settlementId: string) {
  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: {
      group: { select: { name: true } },
      fromMember: { select: { name: true } },
      toMember: { select: { userId: true } },
    },
  });
  if (!settlement || !settlement.toMember.userId) return;

  await prisma.income.upsert({
    where: { settlementId },
    update: {
      amount: settlement.amount,
      date: settlement.settledAt,
    },
    create: {
      userId: settlement.toMember.userId,
      settlementId,
      amount: settlement.amount,
      source: `Repaid by ${settlement.fromMember.name} · ${settlement.group.name}`,
      date: settlement.settledAt,
    },
  });
}

export interface UserGroupBalanceSummary {
  youOwe: string;
  youAreOwed: string;
  groupCount: number;
}

/** Gross, not netted across groups: owing ₹500 in one group and being owed
 * ₹300 in another shows as both, never collapsed into a single ₹200 figure. */
export async function getUserGroupBalanceSummary(userId: string): Promise<UserGroupBalanceSummary> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, isActive: true },
    select: { id: true },
  });

  let youOwe = toMoney(0);
  let youAreOwed = toMoney(0);

  await Promise.all(
    memberships.map(async (m) => {
      const [paid, owed, sent, received] = await Promise.all([
        prisma.groupExpense.aggregate({ where: { paidByMemberId: m.id }, _sum: { amount: true } }),
        prisma.groupExpenseShare.aggregate({
          where: { groupMemberId: m.id },
          _sum: { shareAmount: true },
        }),
        prisma.settlement.aggregate({ where: { fromMemberId: m.id }, _sum: { amount: true } }),
        prisma.settlement.aggregate({ where: { toMemberId: m.id }, _sum: { amount: true } }),
      ]);

      const credit = addMoney(paid._sum.amount?.toString() ?? "0", sent._sum.amount?.toString() ?? "0");
      const debit = addMoney(
        owed._sum.shareAmount?.toString() ?? "0",
        received._sum.amount?.toString() ?? "0"
      );
      const net = subtractMoney(credit, debit);

      if (net.greaterThan(0)) youAreOwed = addMoney(youAreOwed, net);
      else if (net.lessThan(0)) youOwe = addMoney(youOwe, net.abs());
    })
  );

  return {
    youOwe: youOwe.toString(),
    youAreOwed: youAreOwed.toString(),
    groupCount: memberships.length,
  };
}
