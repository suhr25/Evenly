import { ApiError } from "@/lib/api-response";
import {
  computeGroupBalances,
  requireGroupMembership,
  syncSettlementToIncome,
} from "@/lib/data/groups";
import { moneyEquals, toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { simplifyDebts } from "@/lib/settlement";
import {
  captureOrder,
  createOrder,
  getOrder,
  PayPalApiError,
  type PayPalOrder,
} from "@/lib/paypal/client";
import { getPayPalConfig, quoteCharge, type PayPalConfig } from "@/lib/paypal/config";

/**
 * PayPal Sandbox demo settlement flow.
 *
 * The money goes to the configured sandbox MERCHANT, not to the other group member. Evenly
 * only uses the verified capture as proof that the payer "paid" so the existing settlement
 * logic can record it. This is not peer-to-peer payout.
 *
 * Invariants:
 *  - The amount and the payer identity are always derived server-side (current balances +
 *    session), never taken from the request.
 *  - A settlement is recorded only after PayPal reports a COMPLETED capture whose order
 *    reference, merchant, amount and currency match our stored attempt.
 *  - Idempotency: PayPal-Request-Id derived from the payment id (create + capture), a
 *    partial unique index on open attempts, unique order/capture/settlement ids.
 *  - Recovery: PayPal state is always re-read before capturing, and a CAPTURED row (money
 *    taken, DB write failed) is finalized on retry without calling PayPal's capture again.
 */

type Payment = NonNullable<Awaited<ReturnType<typeof prisma.payPalPayment.findUnique>>>;

const OPEN_STATUSES = ["INITIATED", "ORDER_CREATED", "CAPTURE_PENDING", "CAPTURED"] as const;
const UNCAPTURED_STATUSES = ["INITIATED", "ORDER_CREATED"] as const;
/** PayPal orders must be approved within hours; refuse to reuse an older unapproved one. */
const ORDER_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface PaymentView {
  paymentId: string;
  orderId: string | null;
  status: Payment["status"];
  originalAmount: string;
  originalCurrency: string;
  chargeAmount: string;
  chargeCurrency: string;
  exchangeRate: string;
  converted: boolean;
}

function toView(p: Payment): PaymentView {
  return {
    paymentId: p.id,
    orderId: p.paypalOrderId,
    status: p.status,
    originalAmount: toMoney(p.originalAmount.toString()).toFixed(2),
    originalCurrency: p.originalCurrency,
    chargeAmount: toMoney(p.chargeAmount.toString()).toFixed(2),
    chargeCurrency: p.chargeCurrency,
    exchangeRate: p.exchangeRate.toString(),
    converted: p.originalCurrency !== p.chargeCurrency,
  };
}

/** The amount `fromMemberId` currently owes `toMemberId` per the suggested settlements, or null. */
async function getSuggestedAmount(groupId: string, fromMemberId: string, toMemberId: string) {
  const balances = await computeGroupBalances(groupId);
  const match = simplifyDebts(balances.map((b) => ({ memberId: b.memberId, netBalance: b.netBalance }))).find(
    (t) => t.fromMemberId === fromMemberId && t.toMemberId === toMemberId
  );
  return match ? toMoney(match.amount).toFixed(2) : null;
}

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

async function findOpenAttempt(groupId: string, fromMemberId: string, toMemberId: string) {
  return prisma.payPalPayment.findFirst({
    where: { groupId, fromMemberId, toMemberId, status: { in: [...OPEN_STATUSES] } },
  });
}

async function transition(id: string, from: readonly Payment["status"][], data: Record<string, unknown>) {
  const res = await prisma.payPalPayment.updateMany({
    where: { id, status: { in: [...from] } },
    data,
  });
  return res.count > 0;
}

// ---------------------------------------------------------------------------
// Create order
// ---------------------------------------------------------------------------

export async function createPayPalPayment(input: {
  userId: string;
  groupId: string;
  toMemberId: string;
}): Promise<PaymentView> {
  const { userId, groupId, toMemberId } = input;

  const payer = await requireGroupMembership(userId, groupId);
  const config = getPayPalConfig();

  if (payer.id === toMemberId) throw new ApiError(400, "You cannot pay yourself.");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
  if (!user) throw new ApiError(401, "You must be logged in.");

  const recipient = await prisma.groupMember.findFirst({
    where: { id: toMemberId, groupId, isActive: true },
    select: { id: true },
  });
  if (!recipient) throw new ApiError(400, "That member is not an active member of this group.");

  // Amount comes from current balances, never from the browser.
  const owed = await getSuggestedAmount(groupId, payer.id, toMemberId);
  if (!owed) throw new ApiError(409, "You don't currently owe this member anything.");

  const quote = quoteCharge(owed, user.currency, config);

  let attempt = await findOpenAttempt(groupId, payer.id, toMemberId);

  if (attempt && attempt.payerUserId !== userId) {
    // Same member row belonging to a different account would be a data anomaly; refuse.
    throw new ApiError(409, "Another PayPal payment is already in progress for this settlement.");
  }

  if (attempt && (UNCAPTURED_STATUSES as readonly string[]).includes(attempt.status)) {
    const stale =
      !moneyEquals(attempt.originalAmount.toString(), quote.originalAmount) ||
      !moneyEquals(attempt.chargeAmount.toString(), quote.chargeAmount) ||
      attempt.originalCurrency !== quote.originalCurrency ||
      attempt.chargeCurrency !== quote.chargeCurrency ||
      attempt.exchangeRate.toString() !== quote.exchangeRate ||
      attempt.merchantId !== config.merchantId ||
      Date.now() - attempt.createdAt.getTime() > ORDER_MAX_AGE_MS;
    if (stale) {
      // Nothing was captured for these statuses, so abandoning is free.
      await transition(attempt.id, UNCAPTURED_STATUSES, {
        status: "CANCELLED",
        failureReason: "Superseded: balances, rate or configuration changed, or the order expired.",
      });
      attempt = null;
    }
  }

  if (!attempt) {
    try {
      attempt = await prisma.payPalPayment.create({
        data: {
          groupId,
          fromMemberId: payer.id,
          toMemberId,
          payerUserId: userId,
          originalAmount: quote.originalAmount,
          originalCurrency: quote.originalCurrency,
          chargeAmount: quote.chargeAmount,
          chargeCurrency: quote.chargeCurrency,
          exchangeRate: quote.exchangeRate,
          merchantId: config.merchantId,
        },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // A concurrent request (double click) won the race: converge on its attempt.
      attempt = await findOpenAttempt(groupId, payer.id, toMemberId);
      if (!attempt || attempt.payerUserId !== userId) throw err;
    }
  }

  // CAPTURE_PENDING / CAPTURED: the client must reconcile through the capture endpoint.
  if (!(UNCAPTURED_STATUSES as readonly string[]).includes(attempt.status) || attempt.paypalOrderId) {
    return toView(attempt);
  }

  // Idempotent: a retry or concurrent request with the same PayPal-Request-Id yields the same order.
  let order: PayPalOrder;
  try {
    order = await createOrder(config, {
      paymentId: attempt.id,
      amount: quote.chargeAmount,
      currency: quote.chargeCurrency,
      description: "Evenly PayPal Sandbox demo settlement",
      requestId: `evenly-order-${attempt.id}`,
    });
  } catch (err) {
    if (err instanceof PayPalApiError) {
      throw new ApiError(502, "PayPal could not create the order. Please try again.");
    }
    throw err;
  }
  if (!order.id) throw new ApiError(502, "PayPal returned an unexpected response.");

  await prisma.payPalPayment.updateMany({
    where: { id: attempt.id, status: "INITIATED" },
    data: { status: "ORDER_CREATED", paypalOrderId: order.id },
  });
  const fresh = await prisma.payPalPayment.findUnique({ where: { id: attempt.id } });
  return toView(fresh ?? { ...attempt, status: "ORDER_CREATED", paypalOrderId: order.id });
}

// ---------------------------------------------------------------------------
// Capture + verify + record
// ---------------------------------------------------------------------------

export interface CaptureResult {
  status: "COMPLETED" | "CAPTURE_PENDING";
  payment: PaymentView;
  settlementId: string | null;
  message: string;
}

/** Checks that the order's purchase unit is the one we created. Returns a reason on mismatch. */
function checkPurchaseUnit(payment: Payment, order: PayPalOrder, config: PayPalConfig): string | null {
  const unit = order.purchase_units?.[0];
  if (!unit) return "PayPal order has no purchase unit.";
  if (order.purchase_units!.length !== 1) return "PayPal order has unexpected purchase units.";
  if (order.intent && order.intent !== "CAPTURE") return "PayPal order intent is not CAPTURE.";
  if (unit.reference_id !== payment.id || unit.custom_id !== payment.id) return "PayPal order reference mismatch.";
  if (unit.payee?.merchant_id !== payment.merchantId || payment.merchantId !== config.merchantId) {
    return "PayPal order merchant mismatch.";
  }
  if (
    unit.amount?.currency_code !== payment.chargeCurrency ||
    !unit.amount?.value ||
    !moneyEquals(unit.amount.value, payment.chargeAmount.toString())
  ) {
    return "PayPal order amount or currency mismatch.";
  }
  return null;
}

export async function capturePayPalPayment(input: {
  userId: string;
  groupId: string;
  orderId: string;
}): Promise<CaptureResult> {
  const { userId, groupId, orderId } = input;
  await requireGroupMembership(userId, groupId);

  const payment = await prisma.payPalPayment.findFirst({
    where: { paypalOrderId: orderId, groupId, payerUserId: userId },
  });
  if (!payment) throw new ApiError(404, "Payment not found.");

  switch (payment.status) {
    case "COMPLETED":
      return completedResult(payment);
    case "CAPTURED":
      return finalize(payment); // money already taken: reconcile without touching PayPal
    case "NEEDS_REVIEW":
      throw new ApiError(409, payment.failureReason ?? "This payment needs manual review.");
    case "FAILED":
    case "CANCELLED":
      throw new ApiError(409, payment.failureReason ?? "This payment attempt is no longer active.");
    case "INITIATED":
      throw new ApiError(409, "This payment has no PayPal order yet.");
    default:
      break; // ORDER_CREATED | CAPTURE_PENDING
  }

  const config = getPayPalConfig();

  let order = await fetchOrder(config, orderId);

  const mismatch = checkPurchaseUnit(payment, order, config);
  if (mismatch) {
    await transition(payment.id, ["ORDER_CREATED", "CAPTURE_PENDING"], { status: "FAILED", failureReason: mismatch });
    throw new ApiError(409, "The PayPal order did not match this payment, so nothing was recorded.");
  }

  if (order.status === "VOIDED") {
    await transition(payment.id, ["ORDER_CREATED"], { status: "CANCELLED", failureReason: "PayPal order was voided." });
    throw new ApiError(409, "The PayPal order is no longer valid. Start the payment again.");
  }

  if (order.status === "CREATED" || order.status === "PAYER_ACTION_REQUIRED") {
    throw new ApiError(409, "The PayPal order has not been approved yet.");
  }

  if (order.status === "APPROVED") {
    // Balances may have moved since the order was created. Don't charge for a stale amount.
    const current = await getSuggestedAmount(groupId, payment.fromMemberId, payment.toMemberId);
    if (!current || !moneyEquals(current, payment.originalAmount.toString())) {
      await transition(payment.id, ["ORDER_CREATED"], {
        status: "CANCELLED",
        failureReason: "Group balances changed before capture; no charge was made.",
      });
      throw new ApiError(409, "Group balances changed since you started. You were not charged; please start again.");
    }

    try {
      order = await captureOrder(config, orderId, `evenly-capture-${payment.id}`);
    } catch (err) {
      if (!(err instanceof PayPalApiError)) throw err;
      if (err.issues.includes("ORDER_ALREADY_CAPTURED")) {
        order = await fetchOrder(config, orderId);
      } else if (err.httpStatus === 422) {
        const reason = `PayPal declined the capture (${err.issues.join(", ") || "unprocessable"}).`;
        await transition(payment.id, ["ORDER_CREATED", "CAPTURE_PENDING"], { status: "FAILED", failureReason: reason });
        throw new ApiError(409, "PayPal could not complete the payment. You were not charged. Please try again.");
      } else {
        // Unknown outcome (network/5xx). Same Request-Id on retry makes this safe.
        throw new ApiError(502, "PayPal did not confirm the payment. Please retry; you will not be charged twice.");
      }
    }
  }

  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) {
    throw new ApiError(409, "PayPal has not reported a capture for this order yet.");
  }

  const afterMismatch = checkPurchaseUnit(payment, order, config);
  const captureMismatch =
    afterMismatch ??
    (capture.amount?.currency_code !== payment.chargeCurrency ||
    !capture.amount?.value ||
    !moneyEquals(capture.amount.value, payment.chargeAmount.toString())
      ? "PayPal capture amount or currency mismatch."
      : capture.custom_id && capture.custom_id !== payment.id
        ? "PayPal capture reference mismatch."
        : null);

  if (capture.status === "DECLINED" || capture.status === "FAILED") {
    await transition(payment.id, ["ORDER_CREATED", "CAPTURE_PENDING"], {
      status: "FAILED",
      paypalCaptureId: capture.id,
      captureStatus: capture.status,
      failureReason: `PayPal capture ${capture.status.toLowerCase()}.`,
    });
    throw new ApiError(409, "PayPal did not complete the payment. You were not charged.");
  }

  if (captureMismatch) {
    await transition(payment.id, ["ORDER_CREATED", "CAPTURE_PENDING"], {
      status: "NEEDS_REVIEW",
      paypalCaptureId: capture.id,
      captureStatus: capture.status,
      failureReason: `${captureMismatch} Capture ${capture.id} was not recorded as a settlement.`,
    });
    throw new ApiError(409, "The payment could not be verified, so no settlement was recorded. It needs manual review.");
  }

  if (capture.status === "PENDING") {
    await transition(payment.id, ["ORDER_CREATED", "CAPTURE_PENDING"], {
      status: "CAPTURE_PENDING",
      paypalCaptureId: capture.id,
      captureStatus: "PENDING",
    });
    const pending = await prisma.payPalPayment.findUnique({ where: { id: payment.id } });
    return {
      status: "CAPTURE_PENDING",
      payment: toView(pending ?? payment),
      settlementId: null,
      message: "PayPal is still processing this payment. No settlement is recorded until it completes; check again shortly.",
    };
  }

  if (capture.status !== "COMPLETED") {
    await transition(payment.id, ["ORDER_CREATED", "CAPTURE_PENDING"], {
      status: "NEEDS_REVIEW",
      paypalCaptureId: capture.id,
      captureStatus: capture.status,
      failureReason: `Unexpected PayPal capture status ${capture.status}.`,
    });
    throw new ApiError(409, "PayPal returned an unexpected payment status. It needs manual review.");
  }

  // Verified COMPLETED capture. Persist that fact first, so a failure below is recoverable.
  const moved = await transition(payment.id, ["ORDER_CREATED", "CAPTURE_PENDING"], {
    status: "CAPTURED",
    paypalCaptureId: capture.id,
    captureStatus: "COMPLETED",
    capturedAt: new Date(),
  });
  const latest = await prisma.payPalPayment.findUnique({ where: { id: payment.id } });
  if (!latest) throw new ApiError(404, "Payment not found.");
  if (!moved && latest.status === "COMPLETED") return completedResult(latest);

  return finalize(latest);
}

async function fetchOrder(config: PayPalConfig, orderId: string) {
  try {
    return await getOrder(config, orderId);
  } catch (err) {
    if (err instanceof PayPalApiError) {
      throw new ApiError(502, "Could not read the payment from PayPal. Please retry.");
    }
    throw err;
  }
}

async function completedResult(payment: Payment): Promise<CaptureResult> {
  // Income sync is an idempotent upsert; re-running it heals a failure after the settlement commit.
  if (payment.settlementId) await syncSettlementToIncome(payment.settlementId);
  return {
    status: "COMPLETED",
    payment: toView(payment),
    settlementId: payment.settlementId,
    message: "Payment complete. The settlement has been recorded.",
  };
}

/**
 * Records the settlement for a CAPTURED payment. Safe to call repeatedly: the status claim
 * and unique settlementId guarantee at most one settlement per payment.
 */
async function finalize(payment: Payment): Promise<CaptureResult> {
  const current = await getSuggestedAmount(payment.groupId, payment.fromMemberId, payment.toMemberId);
  if (!current || !moneyEquals(current, payment.originalAmount.toString())) {
    const reason =
      `Group balances changed while the PayPal payment was processing. PayPal capture ${payment.paypalCaptureId} ` +
      `(${payment.chargeAmount} ${payment.chargeCurrency}) was not recorded as a settlement; refund it from the sandbox dashboard.`;
    await transition(payment.id, ["CAPTURED"], { status: "NEEDS_REVIEW", failureReason: reason });
    throw new ApiError(
      409,
      "Group balances changed while your payment was processing, so no settlement was recorded. The payment needs manual review."
    );
  }

  const note =
    `PayPal Sandbox demo: charged ${toMoney(payment.chargeAmount.toString()).toFixed(2)} ${payment.chargeCurrency}` +
    (payment.originalCurrency !== payment.chargeCurrency
      ? ` (demo rate ${payment.exchangeRate.toString()} ${payment.originalCurrency} per ${payment.chargeCurrency})`
      : "") +
    `. Order ${payment.paypalOrderId}, capture ${payment.paypalCaptureId}.`;

  const settlement = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payPalPayment.updateMany({
      where: { id: payment.id, status: "CAPTURED", settlementId: null },
      data: { status: "COMPLETED" },
    });
    if (claimed.count === 0) return null; // another request already finished this payment
    const created = await tx.settlement.create({
      data: {
        groupId: payment.groupId,
        fromMemberId: payment.fromMemberId,
        toMemberId: payment.toMemberId,
        amount: payment.originalAmount,
        note,
        createdByUserId: payment.payerUserId,
      },
    });
    await tx.payPalPayment.update({ where: { id: payment.id }, data: { settlementId: created.id } });
    return created;
  });

  const done = await prisma.payPalPayment.findUnique({ where: { id: payment.id } });
  const settlementId = settlement?.id ?? done?.settlementId ?? null;
  if (settlementId) await syncSettlementToIncome(settlementId);

  return {
    status: "COMPLETED",
    payment: toView(done ?? { ...payment, status: "COMPLETED", settlementId }),
    settlementId,
    message: "Payment complete. The settlement has been recorded.",
  };
}
