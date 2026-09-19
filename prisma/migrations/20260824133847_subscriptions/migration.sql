-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('DETECTED', 'ACTIVE', 'IGNORED', 'INACTIVE');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "displayName" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "interval" "RecurrenceInterval" NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 2,
    "firstChargeAt" TIMESTAMP(3) NOT NULL,
    "lastChargeAt" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'DETECTED',
    "sourceExpenseIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_merchant_key" ON "Subscription"("userId", "merchant");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
