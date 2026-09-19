import { Prisma } from "@/generated/prisma/client";
import { addMoney, splitByShares, subtractMoney, toMoney } from "@/lib/money";
import type { ConfirmReceiptInput } from "@/lib/validations/receipt";

type ReceiptWithItems = Prisma.ReceiptGetPayload<{ include: { items: true } }>;

export interface SerializedReceipt {
  id: string;
  imageUrl: string;
  merchant: string | null;
  date: string | null;
  items: { name: string; quantity: string; unitPrice: string; totalPrice: string }[];
  subtotal: string | null;
  tax: string | null;
  discount: string | null;
  tip: string | null;
  total: string | null;
  confidence: string | null;
  extractionFailed: boolean;
}

export function serializeReceipt(
  receipt: ReceiptWithItems,
  imageUrl: string,
  extractionFailed: boolean
): SerializedReceipt {
  return {
    id: receipt.id,
    imageUrl,
    merchant: receipt.merchant,
    date: receipt.date?.toISOString() ?? null,
    items: receipt.items.map((i) => ({
      name: i.name,
      quantity: i.quantity.toString(),
      unitPrice: toMoney(i.unitPrice.toString()).toString(),
      totalPrice: toMoney(i.totalPrice.toString()).toString(),
    })),
    subtotal: receipt.subtotal ? toMoney(receipt.subtotal.toString()).toString() : null,
    tax: receipt.tax ? toMoney(receipt.tax.toString()).toString() : null,
    discount: receipt.discount ? toMoney(receipt.discount.toString()).toString() : null,
    tip: receipt.tip ? toMoney(receipt.tip.toString()).toString() : null,
    total: receipt.total ? toMoney(receipt.total.toString()).toString() : null,
    confidence: receipt.confidence,
    extractionFailed,
  };
}

export interface ComputedMemberShare {
  memberId: string;
  amount: string;
}

/**
 * Weights each participant by the sum of their assigned items (split evenly
 * among co-assignees), then distributes the grand total proportionally to
 * those weights via splitByShares so tax/tip/discount land fairly across
 * everyone and the shares sum exactly to the total.
 */
export function computeReceiptShares(input: ConfirmReceiptInput): ComputedMemberShare[] {
  const weights = new Map<string, number>();

  for (const assignment of input.itemAssignments) {
    const item = input.items[assignment.itemIndex];
    if (!item || assignment.memberIds.length === 0) continue;
    const perPerson = toMoney(item.totalPrice).dividedBy(assignment.memberIds.length).toNumber();
    for (const memberId of assignment.memberIds) {
      weights.set(memberId, (weights.get(memberId) ?? 0) + perPerson);
    }
  }

  const memberIds = [...weights.keys()].filter((id) => (weights.get(id) ?? 0) > 0).sort();
  if (memberIds.length === 0) {
    throw new Error("At least one item must be assigned to someone.");
  }

  const shareAmounts = splitByShares(
    input.total,
    memberIds.map((id) => weights.get(id)!)
  );

  return memberIds.map((memberId, i) => ({ memberId, amount: shareAmounts[i].toString() }));
}

/** Best-effort grand total from itemized fields, used when the AI/user
 * didn't provide (or edited away) an explicit total. */
export function computeReceiptTotal(input: {
  items: { totalPrice: string }[];
  tax?: string | null;
  discount?: string | null;
  tip?: string | null;
}): string {
  const itemsTotal = input.items.reduce((sum, i) => addMoney(sum, i.totalPrice), toMoney(0));
  const withTax = addMoney(itemsTotal, input.tax ?? "0", input.tip ?? "0");
  return subtractMoney(withTax, input.discount ?? "0").toString();
}
