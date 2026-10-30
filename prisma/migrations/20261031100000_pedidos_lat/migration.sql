-- Pedidos de taupoc.lat. Columnas nuevas con valor por defecto: los pedidos
-- existentes quedan como de taupoc.cl.
ALTER TABLE "Order" ADD COLUMN "storefront" TEXT NOT NULL DEFAULT 'CL',
ADD COLUMN "buyerTaxId" TEXT,
ADD COLUMN "dutiesAcceptedAt" TIMESTAMP(3);
