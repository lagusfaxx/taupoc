-- Devoluciones y cambios de talla, con cobro opcional del envío por Mercado Pago.
CREATE TYPE "ReturnKind" AS ENUM ('EXCHANGE', 'REFUND');
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ReturnFeeStatus" AS ENUM ('NONE', 'PENDING', 'PAID', 'WAIVED');

CREATE TABLE "OrderReturn" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "ReturnKind" NOT NULL DEFAULT 'EXCHANGE',
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "feeStatus" "ReturnFeeStatus" NOT NULL DEFAULT 'NONE',
    "feeLabel" TEXT,
    "feeToken" TEXT,
    "feePreferenceId" TEXT,
    "feePaymentId" TEXT,
    "feePaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReturn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderReturn_orderId_key" ON "OrderReturn"("orderId");
CREATE UNIQUE INDEX "OrderReturn_feeToken_key" ON "OrderReturn"("feeToken");
CREATE INDEX "OrderReturn_status_idx" ON "OrderReturn"("status");
CREATE INDEX "OrderReturn_feeStatus_idx" ON "OrderReturn"("feeStatus");

ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
