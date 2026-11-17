-- Se retira la consulta automática a fábrica y la venta a pedido con pago en
-- la tienda. Las tallas agotadas se piden por WhatsApp y se confirman a mano.
ALTER TABLE "Product" DROP COLUMN IF EXISTS "supplierHandle";
ALTER TABLE "ProductColor" DROP COLUMN IF EXISTS "supplierColor";
ALTER TABLE "Variant" DROP COLUMN IF EXISTS "factoryAvailable";
ALTER TABLE "Variant" DROP COLUMN IF EXISTS "factoryCheckedAt";
ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "backorderQty";
DELETE FROM "Setting" WHERE "key" = 'supplierSync';
