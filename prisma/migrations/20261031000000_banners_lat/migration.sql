-- Banners de la portada de taupoc.lat. Tablas y tipos nuevos: no toca nada existente.
CREATE TYPE "IntlBannerAlign" AS ENUM ('LEFT', 'CENTER');
CREATE TYPE "IntlBannerVertical" AS ENUM ('TOP', 'CENTER', 'BOTTOM');
CREATE TYPE "IntlBannerTone" AS ENUM ('DARK', 'LIGHT');
CREATE TYPE "IntlBannerHeight" AS ENUM ('FULL', 'LARGE', 'MEDIUM');

CREATE TABLE "IntlBanner" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT NOT NULL,
    "imageMobileUrl" TEXT,
    "alt" TEXT NOT NULL DEFAULT '',
    "focalX" INTEGER NOT NULL DEFAULT 50,
    "focalY" INTEGER NOT NULL DEFAULT 50,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "align" "IntlBannerAlign" NOT NULL DEFAULT 'LEFT',
    "vertical" "IntlBannerVertical" NOT NULL DEFAULT 'BOTTOM',
    "tone" "IntlBannerTone" NOT NULL DEFAULT 'DARK',
    "overlay" INTEGER NOT NULL DEFAULT 0,
    "height" "IntlBannerHeight" NOT NULL DEFAULT 'LARGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntlBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntlBanner_active_position_idx" ON "IntlBanner"("active", "position");
