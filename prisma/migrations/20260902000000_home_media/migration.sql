-- CreateEnum
CREATE TYPE "HomeBlockType" AS ENUM ('BANNER', 'PRODUCTOS', 'CATEGORIAS', 'MEDIA', 'TEXTO');

-- CreateEnum
CREATE TYPE "BlockHeight" AS ENUM ('AUTO', 'COMPACTA', 'MEDIA', 'ALTA', 'PANTALLA');

-- CreateEnum
CREATE TYPE "BlockAlign" AS ENUM ('IZQUIERDA', 'CENTRO', 'DERECHA');

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaVariant" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeBlock" (
    "id" TEXT NOT NULL,
    "type" "HomeBlockType" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT NOT NULL DEFAULT '',
    "eyebrow" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "body" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "ctaAltLabel" TEXT,
    "ctaAltHref" TEXT,
    "imageUrl" TEXT,
    "imageMobileUrl" TEXT,
    "videoUrl" TEXT,
    "posterUrl" TEXT,
    "fit" TEXT NOT NULL DEFAULT 'cover',
    "overlay" INTEGER NOT NULL DEFAULT 40,
    "height" "BlockHeight" NOT NULL DEFAULT 'MEDIA',
    "align" "BlockAlign" NOT NULL DEFAULT 'IZQUIERDA',
    "background" TEXT NOT NULL DEFAULT 'ink',
    "columns" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeBlockItem" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "productId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "caption" TEXT,
    "href" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,

    CONSTRAINT "HomeBlockItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaVariant_mediaId_width_format_key" ON "MediaVariant"("mediaId", "width", "format");

-- CreateIndex
CREATE INDEX "HomeBlock_active_position_idx" ON "HomeBlock"("active", "position");

-- CreateIndex
CREATE INDEX "HomeBlockItem_blockId_position_idx" ON "HomeBlockItem"("blockId", "position");

-- AddForeignKey
ALTER TABLE "MediaVariant" ADD CONSTRAINT "MediaVariant_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeBlockItem" ADD CONSTRAINT "HomeBlockItem_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "HomeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeBlockItem" ADD CONSTRAINT "HomeBlockItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

