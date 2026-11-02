-- Interés descartado desde el panel (troll o prueba).
ALTER TABLE "SizeInterest" ADD COLUMN "discarded" BOOLEAN NOT NULL DEFAULT false;
