-- AlterTable
-- Todo pedido existente se despachó dentro de Chile: el valor por defecto lo cubre.
ALTER TABLE "Order" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'CL';
