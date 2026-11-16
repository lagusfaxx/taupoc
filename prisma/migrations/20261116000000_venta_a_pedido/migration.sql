-- Venta a pedido: unidades de una línea que se piden a fábrica por no haber stock.
ALTER TABLE "OrderItem" ADD COLUMN "backorderQty" INTEGER NOT NULL DEFAULT 0;
