-- DropIndex
DROP INDEX "ImportedTransaction_userId_idx";

-- AlterTable
ALTER TABLE "ImportedTransaction" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "ImportedTransaction_userId_status_idx" ON "ImportedTransaction"("userId", "status");
