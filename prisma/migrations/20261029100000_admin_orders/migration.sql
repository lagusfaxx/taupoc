-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "creationKey" TEXT,
ADD COLUMN     "stockCommitted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Order_creationKey_key" ON "Order"("creationKey");

-- Reconstruye el compromiso de stock de pedidos anteriores desde su bitácora.
UPDATE "Order" o SET "stockCommitted" = true WHERE EXISTS (
  SELECT 1 FROM "InventoryMovement" m WHERE m."orderId" = o.id
  AND m.type IN ('SALE','CANCEL','RETURN') GROUP BY m."orderId" HAVING SUM(m.delta) < 0
);
