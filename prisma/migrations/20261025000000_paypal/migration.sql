-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYPAL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paypalOrderId" TEXT,
ADD COLUMN "paypalCaptureId" TEXT,
ADD COLUMN "chargedCurrency" TEXT,
ADD COLUMN "chargedCents" INTEGER;

-- CreateIndex
CREATE INDEX "Order_paypalOrderId_idx" ON "Order"("paypalOrderId");
