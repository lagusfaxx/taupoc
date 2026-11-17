-- Oferta por talla: descuento con fecha de término y umbral del badge "quedan pocas".
ALTER TABLE "Variant" ADD COLUMN "salePercent" INTEGER;
ALTER TABLE "Variant" ADD COLUMN "saleEndsAt" TIMESTAMP(3);
ALTER TABLE "Variant" ADD COLUMN "scarcityFrom" INTEGER;
