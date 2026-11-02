-- Un mismo visitante no debe contar varias veces el interés por una talla.
ALTER TABLE "SizeInterest" ADD COLUMN "fingerprint" TEXT;
CREATE INDEX "SizeInterest_variantId_fingerprint_idx" ON "SizeInterest"("variantId", "fingerprint");
CREATE INDEX "SizeInterest_variantId_email_idx" ON "SizeInterest"("variantId", "email");
