-- Analítica propia: visitas, fichas vistas, llegadas al pago y compras.
CREATE TYPE "SiteEventType" AS ENUM ('PAGE_VIEW', 'PRODUCT_VIEW', 'CHECKOUT_START', 'PURCHASE');

CREATE TABLE "SiteEvent" (
    "id" TEXT NOT NULL,
    "type" "SiteEventType" NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "productId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "campaign" TEXT,
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "storefront" TEXT NOT NULL DEFAULT 'CL',
    "orderNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteEvent_createdAt_idx" ON "SiteEvent"("createdAt");
CREATE INDEX "SiteEvent_type_createdAt_idx" ON "SiteEvent"("type", "createdAt");
CREATE INDEX "SiteEvent_sessionId_idx" ON "SiteEvent"("sessionId");
CREATE INDEX "SiteEvent_productId_createdAt_idx" ON "SiteEvent"("productId", "createdAt");
