-- AlterTable
-- Las líneas existentes quedan en el escalón 1; el seed sube VEL-SKIN al 2.
ALTER TABLE "ProductLine" ADD COLUMN "tier" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProductLine" ADD COLUMN "tierLabel" TEXT;
ALTER TABLE "ProductLine" ADD COLUMN "bestFor" TEXT;

-- CreateTable
CREATE TABLE "LineMetric" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LineMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LineMetric_lineId_idx" ON "LineMetric"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "LineMetric_lineId_label_key" ON "LineMetric"("lineId", "label");

-- AddForeignKey
ALTER TABLE "LineMetric" ADD CONSTRAINT "LineMetric_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
