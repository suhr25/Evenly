-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "userCardId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_userCardId_idx" ON "Expense"("userCardId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
