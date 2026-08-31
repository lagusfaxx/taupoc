-- AlterTable
ALTER TABLE "HomeBlock" ADD COLUMN     "intervalSec" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "HomeBlockItem" ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "eyebrow" TEXT,
ADD COLUMN     "posterUrl" TEXT;

