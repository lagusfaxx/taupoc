-- Tipo de cambio de la tienda internacional (taupoc.lat). Tabla nueva: no
-- toca nada de lo existente.

-- CreateEnum
CREATE TYPE "PriceRounding" AS ENUM ('CENTS_99', 'WHOLE', 'WHOLE_9', 'WHOLE_5');

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "clpPerUsd" DECIMAL(10,2) NOT NULL,
    "marginPct" DECIMAL(5,2) NOT NULL,
    "vatPct" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "rounding" "PriceRounding" NOT NULL DEFAULT 'WHOLE_9',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_effectiveFrom_idx" ON "ExchangeRate"("effectiveFrom");

-- Valor de partida: dólar observado al 30-10-2026 y margen de 18 %, que cubre
-- la comisión de PayPal (5,5 %) y la conversión. Se edita desde el panel.
INSERT INTO "ExchangeRate" ("id", "clpPerUsd", "marginPct", "vatPct", "rounding", "createdBy", "note")
VALUES ('fx_inicial', 988.00, 18.00, 19.00, 'WHOLE_9', 'migración', 'Valor de partida');
