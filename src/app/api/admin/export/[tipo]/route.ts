import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { csvDate, csvResponse, toCsv } from '@/lib/csv';
import { regionName } from '@/lib/chile';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/order-labels';
import { rangeFor } from '@/lib/reports';

export const dynamic = 'force-dynamic';

/**
 * Exportación de datos a CSV. Todas las vistas del panel apuntan acá.
 * Requiere sesión de equipo o administrador.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { tipo } = await params;

  switch (tipo) {
    case 'pedidos':
      return exportOrders();
    case 'productos':
      return exportProducts();
    case 'inventario':
      return exportInventory();
    case 'clientes':
      return exportCustomers();
    case 'cotizaciones':
      return exportQuotes();
    case 'ventas':
      return exportSales(request);
    default:
      return NextResponse.json({ error: 'Tipo de exportación no válido' }, { status: 404 });
  }
}

async function exportOrders() {
  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  const rows = orders.flatMap((order) =>
    order.items.map((item) => [
      order.number,
      csvDate(order.createdAt),
      ORDER_STATUS_LABEL[order.status],
      PAYMENT_STATUS_LABEL[order.paymentStatus],
      `${order.firstName ?? ''} ${order.lastName ?? ''}`.trim(),
      order.email,
      order.phone ?? '',
      order.isPickup ? 'Retiro' : 'Despacho',
      order.shippingLabel ?? '',
      order.shippingCarrier ?? '',
      order.trackingNumber ?? '',
      order.commune ?? '',
      regionName(order.region),
      item.productName,
      item.colorName,
      item.size,
      item.sku,
      item.quantity,
      item.unitPrice,
      item.lineTotal,
      order.subtotal,
      order.discountTotal,
      order.couponCode ?? '',
      order.shippingTotal,
      order.total,
      order.mpPaymentId ?? '',
    ]),
  );

  return csvResponse(
    'taupoc-pedidos',
    toCsv(
      [
        'Pedido', 'Fecha', 'Estado', 'Pago', 'Cliente', 'Correo', 'Teléfono',
        'Tipo de entrega', 'Servicio', 'Courier', 'Seguimiento', 'Comuna', 'Región',
        'Producto', 'Color', 'Talla', 'SKU', 'Cantidad', 'Precio unitario', 'Total línea',
        'Subtotal pedido', 'Descuento', 'Cupón', 'Despacho', 'Total pedido', 'ID pago MP',
      ],
      rows,
    ),
  );
}

async function exportProducts() {
  const products = await prisma.product.findMany({
    include: {
      line: { select: { name: true } },
      category: { select: { name: true } },
      variants: { select: { stock: true, active: true } },
      colors: { select: { id: true } },
    },
    orderBy: { name: 'asc' },
  });

  const rows = products.map((product) => [
    product.modelCode,
    product.name,
    product.slug,
    product.status,
    product.gender,
    product.line?.name ?? '',
    product.category?.name ?? '',
    product.approvalCode ?? '',
    product.approvalBody,
    product.basePrice,
    product.compareAtPrice ?? '',
    product.weightGrams,
    product.colors.length,
    product.variants.length,
    product.variants.filter((v) => v.active).reduce((s, v) => s + v.stock, 0),
    product.featured ? 'Sí' : 'No',
    csvDate(product.createdAt),
  ]);

  return csvResponse(
    'taupoc-productos',
    toCsv(
      [
        'Código', 'Nombre', 'URL', 'Estado', 'Género', 'Línea', 'Categoría',
        'Homologación', 'Entidad', 'Precio', 'Precio referencia', 'Peso (g)',
        'Colores', 'SKU', 'Stock total', 'Destacado', 'Creado',
      ],
      rows,
    ),
  );
}

async function exportInventory() {
  const variants = await prisma.variant.findMany({
    include: {
      product: { select: { name: true, modelCode: true, status: true } },
      color: { select: { name: true, code: true, hex: true, stripCode: true } },
    },
    orderBy: [{ product: { name: 'asc' } }, { color: { sortOrder: 'asc' } }, { size: 'asc' }],
  });

  const rows = variants.map((variant) => [
    variant.sku,
    variant.product.modelCode,
    variant.product.name,
    variant.product.status,
    variant.color.name,
    variant.color.code ?? '',
    variant.color.hex,
    variant.color.stripCode ?? '',
    variant.size,
    variant.stock,
    variant.reserved,
    variant.stock - variant.reserved,
    variant.lowStockThreshold,
    variant.active ? 'Sí' : 'No',
  ]);

  return csvResponse(
    'taupoc-inventario',
    toCsv(
      [
        'SKU', 'Código modelo', 'Producto', 'Estado producto', 'Color', 'Colorway', 'Hex',
        'Vivo', 'Talla', 'Stock', 'Reservado', 'Disponible', 'Umbral', 'Activo',
      ],
      rows,
    ),
  );
}

async function exportCustomers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  const spend = await prisma.order.groupBy({
    by: ['email'],
    where: { paymentStatus: 'APPROVED' },
    _sum: { total: true },
    _count: true,
  });
  const byEmail = new Map(spend.map((s) => [s.email, s]));

  const rows = users.map((user) => {
    const stats = byEmail.get(user.email);
    return [
      user.name,
      user.lastName ?? '',
      user.email,
      user.phone ?? '',
      user.rut ?? '',
      user.clubName ?? '',
      user.role,
      user.acceptsMarketing ? 'Sí' : 'No',
      stats?._count ?? 0,
      stats?._sum.total ?? 0,
      csvDate(user.createdAt),
      csvDate(user.lastLoginAt),
    ];
  });

  return csvResponse(
    'taupoc-clientes',
    toCsv(
      [
        'Nombre', 'Apellido', 'Correo', 'Teléfono', 'RUT', 'Club', 'Rol',
        'Acepta comunicaciones', 'Pedidos pagados', 'Total comprado', 'Registro', 'Último ingreso',
      ],
      rows,
    ),
  );
}

async function exportQuotes() {
  const quotes = await prisma.quoteRequest.findMany({ orderBy: { createdAt: 'desc' } });

  const rows = quotes.map((quote) => [
    csvDate(quote.createdAt),
    quote.status,
    quote.clubName,
    quote.contactName,
    quote.interest ?? '',
    quote.email,
    quote.phone,
    regionName(quote.region),
    quote.athletes ?? '',
    quote.message.replace(/\s+/g, ' '),
    quote.adminNote ?? '',
  ]);

  return csvResponse(
    'taupoc-cotizaciones',
    toCsv(
      ['Fecha', 'Estado', 'Club', 'Contacto', 'Cargo', 'Correo', 'Teléfono', 'Región', 'Nadadores', 'Mensaje', 'Nota interna'],
      rows,
    ),
  );
}

async function exportSales(request: NextRequest) {
  const periodParam = request.nextUrl.searchParams.get('periodo') ?? '30d';
  const valid = ['hoy', 'semana', 'mes', 'anio', '30d', '90d'] as const;
  const period = (valid as readonly string[]).includes(periodParam)
    ? (periodParam as (typeof valid)[number])
    : '30d';
  const { from, to } = rangeFor(period);

  const orders = await prisma.order.findMany({
    where: { paymentStatus: 'APPROVED', createdAt: { gte: from, lte: to } },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  });

  const rows = orders.map((order) => [
    order.number,
    csvDate(order.createdAt),
    order.email,
    order.items.reduce((s, i) => s + i.quantity, 0),
    order.subtotal,
    order.discountTotal,
    order.couponCode ?? '',
    order.shippingTotal,
    order.total,
    order.isPickup ? 'Retiro' : regionName(order.region),
    order.mpPaymentType ?? '',
    order.mpInstallments ?? '',
  ]);

  return csvResponse(
    `taupoc-ventas-${period}`,
    toCsv(
      [
        'Pedido', 'Fecha', 'Cliente', 'Unidades', 'Subtotal', 'Descuento', 'Cupón',
        'Despacho', 'Total', 'Destino', 'Medio de pago', 'Cuotas',
      ],
      rows,
    ),
  );
}
