import 'server-only';
import { prisma } from './db';
import { adminOrderSchema } from './admin-order-input';
import { adjustStock, checkLowStock } from './inventory';
import { notifyOrderStatus } from './order-ops';

/** Todos los importes y snapshots se resuelven aquí, nunca desde el navegador. */
export async function createAdminOrder(input: unknown, actor: string) {
  const d = adminOrderSchema.parse(input);
  const order = await prisma.$transaction(async (tx) => {
    // Serializa reintentos del mismo formulario, incluyendo doble clic entre pestañas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d.creationKey}))`;
    const existing = await tx.order.findUnique({ where: { creationKey: d.creationKey } });
    if (existing) return { id: existing.id, created: false };
    const variants = await tx.variant.findMany({
      where: { id: { in: d.items.map((i) => i.variantId) } },
      include: { product: { include: { images: { orderBy: { sortOrder: 'asc' } } } }, color: true },
    });
    if (variants.length !== d.items.length)
      throw new Error('Un producto ya no existe. Recarga el catálogo.');
    const items = d.items.map((item) => {
      const v = variants.find((v) => v.id === item.variantId)!;
      const unitPrice = v.priceOverride ?? v.product.basePrice;
      return {
        variantId: v.id,
        productId: v.productId,
        productName: v.product.name,
        colorName: v.color.name,
        size: v.size,
        sku: v.sku,
        imageUrl:
          (v.product.images.find((i) => i.colorId === v.colorId) ?? v.product.images[0])?.url ??
          null,
        unitPrice,
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const total = subtotal - d.discountTotal + d.shippingTotal;
    if (d.discountTotal > subtotal) throw new Error('El descuento supera el subtotal.');
    if (total > 2_000_000_000 || subtotal > 2_000_000_000)
      throw new Error('El importe del pedido es demasiado alto.');
    const counter = await tx.counter.upsert({
      where: { key: 'order' },
      create: { key: 'order', value: 1001 },
      update: { value: { increment: 1 } },
    });
    const user = await tx.user.findUnique({ where: { email: d.email }, select: { id: true } });
    const paid = d.status !== 'PENDING';
    const created = await tx.order.create({
      data: {
        creationKey: d.creationKey,
        number: `TP-${counter.value}`,
        userId: user?.id,
        email: d.email,
        phone: d.phone,
        firstName: d.firstName,
        lastName: d.lastName,
        status: d.status,
        paymentMethod: 'MANUAL',
        paymentStatus: paid ? 'APPROVED' : 'PENDING',
        paidAt: paid ? new Date() : null,
        stockCommitted: paid,
        subtotal,
        discountTotal: d.discountTotal,
        shippingTotal: d.shippingTotal,
        total,
        isPickup: d.delivery === 'pickup',
        shippingLabel: d.shippingLabel,
        shippingCarrier: d.shippingCarrier || null,
        street: d.delivery === 'shipping' ? d.street : null,
        streetNumber: d.delivery === 'shipping' ? d.streetNumber : null,
        addressExtra: d.delivery === 'shipping' ? d.addressExtra : null,
        commune: d.delivery === 'shipping' ? d.commune : null,
        city: d.delivery === 'shipping' ? d.commune : null,
        region: d.delivery === 'shipping' ? d.region : null,
        customerNote: d.customerNote || null,
        items: { create: items },
        events: { create: { type: 'created', message: 'Pedido creado desde el panel.', actor } },
      },
    });
    if (paid)
      for (const item of items)
        await adjustStock(tx, {
          variantId: item.variantId,
          delta: -item.quantity,
          type: 'SALE',
          reason: 'Pedido creado desde el panel',
          actorEmail: actor,
          orderId: created.id,
        });
    return { id: created.id, created: true };
  });
  if (order.created && d.status !== 'PENDING') void checkLowStock();
  if (order.created) await notifyOrderStatus(order.id, d.status, actor);
  return order.id;
}
