-- DropIndex
DROP INDEX "OrderItem_kalpCouponId_key";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "kalpRestoredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OrderItem_kalpCouponId_idx" ON "OrderItem"("kalpCouponId");
