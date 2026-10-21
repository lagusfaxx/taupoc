-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MERCADOPAGO', 'TRANSFER');

-- AlterTable
-- Todo pedido existente se pagó por Mercado Pago: el valor por defecto lo cubre.
ALTER TABLE "Order" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'MERCADOPAGO',
ADD COLUMN "paymentDiscount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Order_paymentMethod_idx" ON "Order"("paymentMethod");
