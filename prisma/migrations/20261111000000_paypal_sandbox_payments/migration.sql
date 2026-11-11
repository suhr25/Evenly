-- CreateEnum
CREATE TYPE "PayPalPaymentStatus" AS ENUM ('INITIATED', 'ORDER_CREATED', 'CAPTURE_PENDING', 'CAPTURED', 'COMPLETED', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "PayPalPayment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fromMemberId" TEXT NOT NULL,
    "toMemberId" TEXT NOT NULL,
    "payerUserId" TEXT NOT NULL,
    "status" "PayPalPaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "originalAmount" DECIMAL(12,2) NOT NULL,
    "originalCurrency" TEXT NOT NULL,
    "chargeAmount" DECIMAL(12,2) NOT NULL,
    "chargeCurrency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,8) NOT NULL,
    "merchantId" TEXT NOT NULL,
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "captureStatus" TEXT,
    "failureReason" TEXT,
    "settlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3),

    CONSTRAINT "PayPalPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayPalPayment_paypalOrderId_key" ON "PayPalPayment"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalPayment_paypalCaptureId_key" ON "PayPalPayment"("paypalCaptureId");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalPayment_settlementId_key" ON "PayPalPayment"("settlementId");

-- CreateIndex
CREATE INDEX "PayPalPayment_groupId_fromMemberId_toMemberId_idx" ON "PayPalPayment"("groupId", "fromMemberId", "toMemberId");

-- CreateIndex
CREATE INDEX "PayPalPayment_payerUserId_idx" ON "PayPalPayment"("payerUserId");

-- Partial unique index (hand-written; Prisma cannot express it): at most one open attempt
-- per group/payer/recipient, so a double click or concurrent request cannot create two orders.
CREATE UNIQUE INDEX "PayPalPayment_one_open_attempt_key"
  ON "PayPalPayment"("groupId", "fromMemberId", "toMemberId")
  WHERE "status" IN ('INITIATED', 'ORDER_CREATED', 'CAPTURE_PENDING', 'CAPTURED');

-- AddForeignKey
ALTER TABLE "PayPalPayment" ADD CONSTRAINT "PayPalPayment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPalPayment" ADD CONSTRAINT "PayPalPayment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
