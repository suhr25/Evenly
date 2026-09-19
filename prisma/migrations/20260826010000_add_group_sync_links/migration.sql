-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "groupExpenseId" TEXT;

-- AlterTable
ALTER TABLE "Income" ADD COLUMN "settlementId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_groupExpenseId_userId_key" ON "Expense"("groupExpenseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Income_settlementId_key" ON "Income"("settlementId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_groupExpenseId_fkey" FOREIGN KEY ("groupExpenseId") REFERENCES "GroupExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
