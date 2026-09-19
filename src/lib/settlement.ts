import { fromMinorUnits, toMinorUnits, type MoneyInput } from "@/lib/money";

export interface MemberBalanceInput {
  memberId: string;
  netBalance: MoneyInput;
}

export interface SettlementTransaction {
  fromMemberId: string;
  toMemberId: string;
  amount: string;
}

interface Node {
  memberId: string;
  /** Minor units (paise), always positive. */
  amount: number;
}

/**
 * Turns a set of net balances into the minimum number of payments needed to
 * settle everyone up, via the standard greedy max-creditor/max-debtor match:
 * repeatedly pay the largest debtor to the largest creditor until both hit
 * zero. This produces at most (n - 1) transactions for n people with a
 * non-zero balance, which is what every mainstream splitting app ships
 * (the theoretical global minimum is NP-hard to compute in general; this
 * greedy heuristic is optimal in practice for the balance distributions a
 * real group produces).
 *
 * Deterministic: ties are broken by memberId so the same input always
 * produces the same output, in the same order, run after run.
 */
export function simplifyDebts(balances: MemberBalanceInput[]): SettlementTransaction[] {
  const creditors: Node[] = [];
  const debtors: Node[] = [];

  for (const b of balances) {
    const minor = toMinorUnits(b.netBalance);
    if (minor > 0) creditors.push({ memberId: b.memberId, amount: minor });
    else if (minor < 0) debtors.push({ memberId: b.memberId, amount: -minor });
  }

  const byAmountDescThenId = (a: Node, b: Node) => b.amount - a.amount || a.memberId.localeCompare(b.memberId);
  creditors.sort(byAmountDescThenId);
  debtors.sort(byAmountDescThenId);

  const transactions: SettlementTransaction[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0) {
      transactions.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount: fromMinorUnits(amount).toString(),
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount === 0) ci += 1;
    if (debtor.amount === 0) di += 1;
  }

  return transactions;
}
