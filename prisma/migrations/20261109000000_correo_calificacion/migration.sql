-- Correo automático que pide calificar los productos de un pedido entregado.
ALTER TABLE "Order"
    ADD COLUMN "reviewToken" TEXT,
    ADD COLUMN "reviewRequestedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_reviewToken_key" ON "Order"("reviewToken");
CREATE INDEX "Order_reviewRequestedAt_idx" ON "Order"("reviewRequestedAt");

-- Opiniones que llegan desde ese correo quedan atadas a su pedido.
ALTER TABLE "Review" ADD COLUMN "orderId" TEXT;

CREATE UNIQUE INDEX "Review_orderId_productId_key" ON "Review"("orderId", "productId");

ALTER TABLE "Review"
    ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
