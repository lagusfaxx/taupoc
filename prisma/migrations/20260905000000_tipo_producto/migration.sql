-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('SWIMSUIT', 'ACCESSORY');

-- AlterTable
-- Lo existente es todo traje de competición: el valor por defecto ya lo cubre.
ALTER TABLE "Product" ADD COLUMN "kind" "ProductKind" NOT NULL DEFAULT 'SWIMSUIT';
