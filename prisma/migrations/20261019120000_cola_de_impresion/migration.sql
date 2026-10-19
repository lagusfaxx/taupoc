-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'PRINTED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "refs" TEXT[],
    "copies" INTEGER NOT NULL DEFAULT 1,
    "pdf" BYTEA NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintJob_status_createdAt_idx" ON "PrintJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PrintJob_kind_idx" ON "PrintJob"("kind");
