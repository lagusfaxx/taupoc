-- Stock de fábrica: enlace con la tienda B2B del proveedor.
ALTER TABLE "Product" ADD COLUMN "supplierHandle" TEXT;
ALTER TABLE "ProductColor" ADD COLUMN "supplierColor" TEXT;
ALTER TABLE "Variant" ADD COLUMN "factoryAvailable" BOOLEAN;
ALTER TABLE "Variant" ADD COLUMN "factoryCheckedAt" TIMESTAMP(3);
