-- CreateEnum
CREATE TYPE "CardNetwork" AS ENUM ('VISA', 'MASTERCARD', 'RUPAY', 'AMEX', 'DINERS');

-- CreateEnum
CREATE TYPE "RewardCurrencyType" AS ENUM ('POINTS', 'CASHBACK', 'MILES');

-- CreateEnum
CREATE TYPE "CardChannel" AS ENUM ('ANY', 'ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "CardCapPeriod" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "CardDataSource" AS ENUM ('MANUAL', 'AA_SYNC', 'ISSUER_SYNC');

-- CreateTable
CREATE TABLE "Issuer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardCurrency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RewardCurrencyType" NOT NULL,
    "unitValueInr" DECIMAL(6,4) NOT NULL,
    "valueNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardCurrency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardProduct" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "network" "CardNetwork" NOT NULL,
    "variant" TEXT,
    "joiningFee" DECIMAL(12,2),
    "annualFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "annualFeeWaiverSpend" DECIMAL(12,2),
    "rewardCurrencyId" TEXT,
    "baseRewardRateOnCurrency" DECIMAL(6,3),
    "foreignTxnFeePercent" DECIMAL(5,2),
    "loungeAccessDomestic" INTEGER,
    "loungeAccessIntl" INTEGER,
    "milestoneNote" TEXT,
    "benefitsNote" TEXT,
    "exclusionsNote" TEXT,
    "eligibilityNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSeedData" BOOLEAN NOT NULL DEFAULT true,
    "sourceNote" TEXT,
    "sourceCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardCategoryRule" (
    "id" TEXT NOT NULL,
    "cardProductId" TEXT NOT NULL,
    "categoryId" TEXT,
    "channel" "CardChannel" NOT NULL DEFAULT 'ANY',
    "multiplier" DECIMAL(4,2) NOT NULL,
    "capAmount" DECIMAL(12,2),
    "capPeriod" "CardCapPeriod",
    "notes" TEXT,

    CONSTRAINT "CardCategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardProductId" TEXT NOT NULL,
    "nickname" TEXT,
    "lastFourDigits" TEXT,
    "creditLimit" DECIMAL(12,2),
    "outstanding" DECIMAL(12,2),
    "rewardBalance" DECIMAL(12,2),
    "statementDate" INTEGER,
    "paymentDueDate" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "creditLimitSource" "CardDataSource" NOT NULL DEFAULT 'MANUAL',
    "outstandingSource" "CardDataSource" NOT NULL DEFAULT 'MANUAL',
    "rewardBalanceSource" "CardDataSource" NOT NULL DEFAULT 'MANUAL',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Issuer_name_key" ON "Issuer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Issuer_shortCode_key" ON "Issuer"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "RewardCurrency_name_key" ON "RewardCurrency"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CardProduct_slug_key" ON "CardProduct"("slug");

-- CreateIndex
CREATE INDEX "CardProduct_issuerId_idx" ON "CardProduct"("issuerId");

-- CreateIndex
CREATE UNIQUE INDEX "CardProduct_issuerId_name_key" ON "CardProduct"("issuerId", "name");

-- CreateIndex
CREATE INDEX "CardCategoryRule_cardProductId_idx" ON "CardCategoryRule"("cardProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CardCategoryRule_cardProductId_categoryId_channel_key" ON "CardCategoryRule"("cardProductId", "categoryId", "channel");

-- CreateIndex
CREATE INDEX "UserCard_userId_idx" ON "UserCard"("userId");

-- CreateIndex
CREATE INDEX "UserCard_cardProductId_idx" ON "UserCard"("cardProductId");

-- AddForeignKey
ALTER TABLE "CardProduct" ADD CONSTRAINT "CardProduct_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "Issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardProduct" ADD CONSTRAINT "CardProduct_rewardCurrencyId_fkey" FOREIGN KEY ("rewardCurrencyId") REFERENCES "RewardCurrency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCategoryRule" ADD CONSTRAINT "CardCategoryRule_cardProductId_fkey" FOREIGN KEY ("cardProductId") REFERENCES "CardProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCategoryRule" ADD CONSTRAINT "CardCategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_cardProductId_fkey" FOREIGN KEY ("cardProductId") REFERENCES "CardProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
