-- Demanda de tallas: lo que entra al carrito y el interés por tallas agotadas.
CREATE TABLE "CartEvent" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CartEvent_variantId_idx" ON "CartEvent"("variantId");
CREATE INDEX "CartEvent_createdAt_idx" ON "CartEvent"("createdAt");
ALTER TABLE "CartEvent" ADD CONSTRAINT "CartEvent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SizeInterest" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SizeInterest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SizeInterest_variantId_visitorKey_key" ON "SizeInterest"("variantId", "visitorKey");
CREATE INDEX "SizeInterest_createdAt_idx" ON "SizeInterest"("createdAt");
ALTER TABLE "SizeInterest" ADD CONSTRAINT "SizeInterest_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
