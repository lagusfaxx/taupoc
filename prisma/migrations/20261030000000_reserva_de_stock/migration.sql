-- Reserva de stock al iniciar el pago. Solo agrega columnas con valor por
-- defecto: los pedidos existentes quedan sin reserva, igual que hasta ahora.
ALTER TABLE "Order" ADD COLUMN "stockReserved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reservedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_stockReserved_reservedUntil_idx" ON "Order"("stockReserved", "reservedUntil");
