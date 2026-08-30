import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  SIZES,
  RSKIN_COLORS,
  VELSKIN_COLORS,
  MEN_SIZE_CHART,
  WOMEN_SIZE_CHART,
  INITIAL_STOCK,
  UNITS_PER_SKU,
  type ColorSpec,
  type SizeRow,
} from './catalog-data';
import { generateProductImages, generateWideImage } from './placeholder-images';

const prisma = new PrismaClient();

function stockFor(modelCode: string, colorCode: string | null, size: string): number {
  if (!colorCode) return 0;
  const codes = INITIAL_STOCK[modelCode]?.[size];
  return codes?.includes(colorCode) ? UNITS_PER_SKU : 0;
}

function chartRows(rows: SizeRow[]): Prisma.SizeChartRowCreateWithoutProductInput[] {
  return rows.map((r, i) => ({
    size: r.size,
    chestMinCm: r.chest?.[0], chestMaxCm: r.chest?.[1],
    waistMinCm: r.waist[0], waistMaxCm: r.waist[1],
    hipMinCm: r.hip[0], hipMaxCm: r.hip[1],
    heightMinCm: r.height[0], heightMaxCm: r.height[1],
    cn: r.cn, usa: r.usa, uk: r.uk, aus: r.aus, nz: r.nz,
    sortOrder: i,
  }));
}

interface ProductSeed {
  slug: string;
  name: string;
  modelCode: string;
  subtitle: string;
  gender: 'MALE' | 'FEMALE';
  lineSlug: 'r-skin' | 'vel-skin';
  approvalCode: string;
  status: 'ACTIVE' | 'COMING_SOON';
  basePrice: number;
  weightGrams: number;
  colors: ColorSpec[];
  chart: SizeRow[];
  description: string;
  composition: string;
  construction: string;
  finish: string;
  fitNotes: string;
  specs: { label: string; value: string }[];
  featured: boolean;
}

const FIT_MEN =
  'Los jammers de competición se usan comprimidos. Si estás entre dos tallas, elige la menor. ' +
  'Para carreras de velocidad la mayoría de los nadadores baja 1 a 2 tallas respecto de su ropa habitual; ' +
  'para pruebas de fondo, baja solo 1.';

const FIT_WOMEN =
  'El knee suit debe entrar con esfuerzo: esa tensión es la que genera la compresión. ' +
  'Baja 1 a 2 tallas respecto de tu talla habitual de entrenamiento. ' +
  'Ponte el traje con las manos abiertas, nunca tirando con las uñas.';

const PRODUCTS: ProductSeed[] = [
  {
    slug: 'r-skin-jammer-ts703',
    name: 'R-SKIN Jammer',
    modelCode: 'TS703',
    subtitle: 'Jammer de competición masculino',
    gender: 'MALE',
    lineSlug: 'r-skin',
    approvalCode: 'TA146514',
    status: 'ACTIVE',
    basePrice: 139900,
    weightGrams: 170,
    colors: RSKIN_COLORS,
    chart: MEN_SIZE_CHART,
    description:
      'El R-SKIN Jammer es la pieza de referencia de TAUPOC: tejido técnico italiano de alta densidad, ' +
      'construcción termosellada sin costuras y un patronaje que comprime el core sin restringir el rolido de cadera. ' +
      'Homologado por World Aquatics para competencia oficial en todas las categorías.\n\n' +
      'Diseñado para nadadores que compiten en serio. La compresión progresiva sostiene la posición horizontal ' +
      'en los metros finales, cuando la técnica empieza a caerse, y el acabado hidrofóbico reduce la absorción ' +
      'de agua durante toda la sesión de competencia.',
    composition: '72% Poliamida · 28% Elastano (tejido italiano de alta densidad)',
    construction: 'Bonding térmico sin costuras · Uniones ultrasónicas planas',
    finish: 'Tratamiento hidrofóbico de baja absorción · Protección UPF 50+',
    fitNotes: FIT_MEN,
    featured: true,
    specs: [
      { label: 'Homologación', value: 'World Aquatics TA146514' },
      { label: 'Tipo', value: 'Jammer (hasta la rodilla)' },
      { label: 'Compresión', value: 'Alta — zona core y muslo' },
      { label: 'Flotabilidad', value: 'Neutra (según normativa)' },
      { label: 'Vida útil estimada', value: '25 a 30 competencias' },
      { label: 'Cierre', value: 'Cordón interno plano' },
      { label: 'Origen del tejido', value: 'Italia' },
    ],
  },
  {
    slug: 'r-skin-knee-suit-ts704',
    name: 'R-SKIN Knee Suit',
    modelCode: 'TS704',
    subtitle: 'Traje de competición femenino hasta la rodilla',
    gender: 'FEMALE',
    lineSlug: 'r-skin',
    approvalCode: 'TA224135',
    status: 'ACTIVE',
    basePrice: 189900,
    weightGrams: 215,
    colors: RSKIN_COLORS,
    chart: WOMEN_SIZE_CHART,
    description:
      'El R-SKIN Knee Suit lleva la misma tecnología del jammer a un traje de cuerpo completo hasta la rodilla. ' +
      'Espalda abierta de corte cerrado para máxima libertad de brazada, paneles de compresión diferenciada en ' +
      'abdomen y glúteo, y tirantes anchos que no se clavan en el hombro durante la salida.\n\n' +
      'Homologado por World Aquatics. La estructura interna mantiene la línea de cadera alta sin comprimir la caja ' +
      'torácica, para que la respiración no se vea afectada en pruebas de 200 metros en adelante.',
    composition: '74% Poliamida · 26% Elastano (tejido italiano de alta densidad)',
    construction: 'Bonding térmico sin costuras · Panel dorsal de tensión continua',
    finish: 'Tratamiento hidrofóbico de baja absorción · Protección UPF 50+',
    fitNotes: FIT_WOMEN,
    featured: true,
    specs: [
      { label: 'Homologación', value: 'World Aquatics TA224135' },
      { label: 'Tipo', value: 'Knee suit (cuerpo completo hasta la rodilla)' },
      { label: 'Espalda', value: 'Abierta, corte cerrado' },
      { label: 'Compresión', value: 'Alta — diferenciada por panel' },
      { label: 'Flotabilidad', value: 'Neutra (según normativa)' },
      { label: 'Vida útil estimada', value: '25 a 30 competencias' },
      { label: 'Origen del tejido', value: 'Italia' },
    ],
  },
  {
    slug: 'vel-skin-jammer-ts705',
    name: 'VEL-SKIN Jammer',
    modelCode: 'TS705',
    subtitle: 'Jammer de competición masculino — nueva generación',
    gender: 'MALE',
    lineSlug: 'vel-skin',
    approvalCode: 'TA148911',
    status: 'COMING_SOON',
    basePrice: 179900,
    weightGrams: 165,
    colors: VELSKIN_COLORS,
    chart: MEN_SIZE_CHART,
    description:
      'VEL-SKIN es la evolución del R-SKIN: mismo ADN de compresión, tejido un 12% más liviano y una malla ' +
      'de tracción interna que redistribuye la tensión hacia el eje longitudinal del cuerpo.\n\n' +
      'Pensado para nadadores de élite que buscan el máximo retorno en pruebas de velocidad. ' +
      'Homologado por World Aquatics. Disponible próximamente en Chile.',
    composition: '70% Poliamida · 30% Elastano (tejido italiano ultraliviano)',
    construction: 'Bonding térmico · Malla de tracción longitudinal interna',
    finish: 'Acabado hidrofóbico de segunda generación · UPF 50+',
    fitNotes: FIT_MEN,
    featured: false,
    specs: [
      { label: 'Homologación', value: 'World Aquatics TA148911' },
      { label: 'Tipo', value: 'Jammer (hasta la rodilla)' },
      { label: 'Compresión', value: 'Muy alta — eje longitudinal' },
      { label: 'Peso', value: '12% más liviano que R-SKIN' },
      { label: 'Disponibilidad', value: 'Próximamente' },
      { label: 'Origen del tejido', value: 'Italia' },
    ],
  },
  {
    slug: 'vel-skin-knee-suit-ts706',
    name: 'VEL-SKIN Knee Suit',
    modelCode: 'TS706',
    subtitle: 'Traje de competición femenino — nueva generación',
    gender: 'FEMALE',
    lineSlug: 'vel-skin',
    approvalCode: 'TA228496',
    status: 'COMING_SOON',
    basePrice: 229900,
    weightGrams: 205,
    colors: VELSKIN_COLORS,
    chart: WOMEN_SIZE_CHART,
    description:
      'El VEL-SKIN Knee Suit combina el tejido ultraliviano de la línea con un patronaje de espalda ' +
      'completamente rediseñado, que libera la rotación escapular sin perder tensión dorsal.\n\n' +
      'Homologado por World Aquatics. Disponible próximamente en Chile.',
    composition: '72% Poliamida · 28% Elastano (tejido italiano ultraliviano)',
    construction: 'Bonding térmico · Panel dorsal de rotación libre',
    finish: 'Acabado hidrofóbico de segunda generación · UPF 50+',
    fitNotes: FIT_WOMEN,
    featured: false,
    specs: [
      { label: 'Homologación', value: 'World Aquatics TA228496' },
      { label: 'Tipo', value: 'Knee suit (cuerpo completo hasta la rodilla)' },
      { label: 'Espalda', value: 'Panel de rotación libre' },
      { label: 'Compresión', value: 'Muy alta — diferenciada' },
      { label: 'Disponibilidad', value: 'Próximamente' },
      { label: 'Origen del tejido', value: 'Italia' },
    ],
  },
];

async function seedLines() {
  const lines = [
    {
      slug: 'r-skin',
      name: 'R-SKIN',
      tagline: 'La línea de competición de referencia',
      description:
        'Tejido italiano de alta densidad y construcción termosellada. La línea con la que compiten la mayoría ' +
        'de nuestros nadadores federados. Disponible en 15 colores y en las nueve tallas de competición.',
      accentHex: '#00E0B8',
      sortOrder: 1,
    },
    {
      slug: 'vel-skin',
      name: 'VEL-SKIN',
      tagline: 'Nueva generación, ultraliviana',
      description:
        'Evolución del R-SKIN: 12% más liviana, con malla de tracción interna que redistribuye la tensión ' +
        'hacia el eje longitudinal. Lanzamiento próximo en Chile.',
      accentHex: '#A46BFF',
      sortOrder: 2,
    },
    {
      slug: 'accesorios',
      name: 'Accesorios',
      tagline: 'Gorros, antiparras y equipamiento',
      description: 'Gorros de silicona de baja resistencia, antiparras de competición y mochilas técnicas.',
      accentHex: '#4B9BF0',
      sortOrder: 3,
    },
  ];
  for (const line of lines) {
    await prisma.productLine.upsert({ where: { slug: line.slug }, create: line, update: line });
  }
}

async function seedCategories() {
  const categories = [
    { slug: 'competicion-hombre', name: 'Competición Hombre', description: 'Jammers homologados World Aquatics.', sortOrder: 1 },
    { slug: 'competicion-mujer', name: 'Competición Mujer', description: 'Knee suits homologados World Aquatics.', sortOrder: 2 },
    { slug: 'gorros', name: 'Gorros', description: 'Gorros de silicona de baja resistencia.', sortOrder: 3 },
    { slug: 'antiparras', name: 'Antiparras', description: 'Antiparras de competición antiempañantes.', sortOrder: 4 },
    { slug: 'mochilas', name: 'Mochilas y bolsos', description: 'Equipamiento para llevar a la piscina.', sortOrder: 5 },
  ];
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, create: c, update: c });
  }
}

async function seedProducts() {
  for (const p of PRODUCTS) {
    const line = await prisma.productLine.findUnique({ where: { slug: p.lineSlug } });
    const category = await prisma.category.findUnique({
      where: { slug: p.gender === 'MALE' ? 'competicion-hombre' : 'competicion-mujer' },
    });

    const data = {
      slug: p.slug,
      name: p.name,
      modelCode: p.modelCode,
      subtitle: p.subtitle,
      description: p.description,
      status: p.status,
      gender: p.gender,
      categoryId: category?.id ?? null,
      lineId: line?.id ?? null,
      approvalCode: p.approvalCode,
      approvalBody: 'World Aquatics',
      approvalYear: 2024,
      approvalVerifyUrl: 'https://www.worldaquatics.com/swimming/approved-swimwear',
      basePrice: p.basePrice,
      weightGrams: p.weightGrams,
      composition: p.composition,
      construction: p.construction,
      finish: p.finish,
      countryOrigin: 'Tejido italiano · Confección TAUPOC',
      careNotes:
        'Enjuagar con agua fría inmediatamente después de cada uso. Secar a la sombra, extendido. ' +
        'No usar lavadora, secadora, cloro ni suavizante. No planchar ni retorcer.',
      fitNotes: p.fitNotes,
      fitOffset: 1,
      featured: p.featured,
      seoTitle: `${p.name} ${p.modelCode} — Homologado World Aquatics ${p.approvalCode}`,
      seoDescription:
        `${p.name} de competición TAUPOC, homologación World Aquatics ${p.approvalCode}. ` +
        `Tallas 20 a 36. Despacho a todo Chile y retiro sin costo en Santiago.`,
    };

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      create: data,
      update: data,
    });

    await prisma.sizeChartRow.deleteMany({ where: { productId: product.id } });
    await prisma.sizeChartRow.createMany({
      data: chartRows(p.chart).map((r) => ({ ...r, productId: product.id })),
    });

    await prisma.productSpec.deleteMany({ where: { productId: product.id } });
    await prisma.productSpec.createMany({
      data: p.specs.map((s, i) => ({ ...s, productId: product.id, sortOrder: i })),
    });

    for (const [colorIndex, color] of p.colors.entries()) {
      const colorData = {
        name: color.name,
        code: color.code,
        hex: color.hex,
        accentHex: color.accentHex,
        stripCode: color.stripCode,
        stripHex: color.stripHex,
        active: color.active,
        sortOrder: colorIndex,
      };
      const productColor = await prisma.productColor.upsert({
        where: { productId_slug: { productId: product.id, slug: color.slug } },
        create: { productId: product.id, slug: color.slug, ...colorData },
        update: colorData,
      });

      const existingImages = await prisma.productImage.count({
        where: { productId: product.id, colorId: productColor.id },
      });
      if (existingImages === 0) {
        const images = await generateProductImages({
          productSlug: p.slug,
          productName: p.name,
          colorSlug: color.slug,
          colorName: color.name,
          hex: color.hex,
        });
        await prisma.productImage.createMany({
          data: images.map((img, i) => ({
            productId: product.id,
            colorId: productColor.id,
            url: img.url,
            alt: img.alt,
            width: img.width,
            height: img.height,
            sortOrder: i,
            isPrimary: colorIndex === 0 && i === 0,
          })),
        });
      }

      for (const [sizeIndex, size] of SIZES.entries()) {
        const sku = `${p.modelCode}-${color.code ?? color.slug.toUpperCase().slice(0, 3)}-${size}`;
        const stock = p.status === 'COMING_SOON' ? 0 : stockFor(p.modelCode, color.code, size);
        await prisma.variant.upsert({
          where: {
            productId_colorId_size: { productId: product.id, colorId: productColor.id, size },
          },
          create: {
            productId: product.id,
            colorId: productColor.id,
            size,
            sku,
            stock,
            sortOrder: sizeIndex,
            active: color.active,
          },
          update: { sku, stock, sortOrder: sizeIndex, active: color.active },
        });
      }
    }
    const units = await prisma.variant.aggregate({
      where: { productId: product.id },
      _sum: { stock: true },
    });
    const withStock = await prisma.variant.count({
      where: { productId: product.id, stock: { gt: 0 } },
    });
    console.log(
      `  · ${p.name} (${p.modelCode}) — ${p.colors.length} colorways × ${SIZES.length} tallas · ` +
        `${withStock} SKU con stock · ${units._sum.stock ?? 0} unidades`,
    );
  }
}

async function seedShipping() {
  const zones = [
    {
      name: 'Región Metropolitana',
      regions: ['RM'],
      sortOrder: 1,
      rates: [
        { carrier: 'Chilexpress', label: 'Domicilio express', description: 'Entrega en 1 a 2 días hábiles.', mode: 'FLAT' as const, price: 4490, etaMinDays: 1, etaMaxDays: 2, sortOrder: 1 },
        { carrier: 'Starken', label: 'Domicilio estándar', description: 'Entrega en 2 a 4 días hábiles.', mode: 'FLAT' as const, price: 3490, etaMinDays: 2, etaMaxDays: 4, sortOrder: 2 },
        { carrier: 'Correos de Chile', label: 'Encomienda normal', description: 'La opción más económica dentro de Santiago.', mode: 'FLAT' as const, price: 2990, etaMinDays: 3, etaMaxDays: 5, sortOrder: 3 },
      ],
    },
    {
      name: 'Regiones centro y sur',
      regions: ['V', 'VI', 'VII', 'XVI', 'VIII', 'IX', 'XIV', 'X', 'IV', 'III'],
      sortOrder: 2,
      rates: [
        { carrier: 'Chilexpress', label: 'Domicilio express regiones', description: 'Entrega en 2 a 4 días hábiles.', mode: 'FLAT' as const, price: 6490, etaMinDays: 2, etaMaxDays: 4, sortOrder: 1 },
        { carrier: 'Starken', label: 'Retiro en sucursal', description: 'Retiras en la sucursal Starken más cercana.', mode: 'FLAT' as const, price: 4990, etaMinDays: 3, etaMaxDays: 5, sortOrder: 2 },
        { carrier: 'Correos de Chile', label: 'Encomienda regiones', description: 'Entrega en 4 a 7 días hábiles.', mode: 'FLAT' as const, price: 4290, etaMinDays: 4, etaMaxDays: 7, sortOrder: 3 },
      ],
    },
    {
      name: 'Zonas extremas',
      regions: ['XV', 'I', 'II', 'XI', 'XII'],
      sortOrder: 3,
      rates: [
        { carrier: 'Chilexpress', label: 'Domicilio zona extrema', description: 'Entrega en 4 a 8 días hábiles.', mode: 'FLAT' as const, price: 9990, etaMinDays: 4, etaMaxDays: 8, sortOrder: 1 },
        { carrier: 'Starken', label: 'Sucursal zona extrema', description: 'Retiro en sucursal. La alternativa más económica.', mode: 'FLAT' as const, price: 7990, etaMinDays: 5, etaMaxDays: 9, sortOrder: 2 },
      ],
    },
    {
      name: 'Retiro y entrega presencial',
      regions: [],
      sortOrder: 0,
      rates: [
        {
          carrier: 'TAUPOC Chile', label: 'Retiro en tienda',
          description: 'Providencia, Santiago. Te avisamos cuando esté listo para retirar.',
          mode: 'FLAT' as const, price: 0, etaMinDays: 1, etaMaxDays: 2, isPickup: true,
          pickupInfo: 'Av. Providencia, Santiago. Lunes a viernes de 10:00 a 19:00. Presenta tu número de pedido.',
          sortOrder: 1,
        },
        {
          carrier: 'TAUPOC Chile', label: 'Entrega en torneo',
          description: 'Retira tu pedido en nuestro stand del próximo torneo.',
          mode: 'FLAT' as const, price: 0, etaMinDays: 1, etaMaxDays: 14, isPickup: true,
          pickupInfo: 'Coordinamos por WhatsApp el torneo y el horario de entrega en el stand.',
          sortOrder: 2,
        },
      ],
    },
  ];

  for (const zone of zones) {
    const existing = await prisma.shippingZone.findFirst({ where: { name: zone.name } });
    const record = existing
      ? await prisma.shippingZone.update({
          where: { id: existing.id },
          data: { regions: zone.regions, sortOrder: zone.sortOrder, active: true },
        })
      : await prisma.shippingZone.create({
          data: { name: zone.name, regions: zone.regions, sortOrder: zone.sortOrder },
        });

    for (const rate of zone.rates) {
      const found = await prisma.shippingRate.findFirst({
        where: { zoneId: record.id, label: rate.label, carrier: rate.carrier },
      });
      if (found) {
        await prisma.shippingRate.update({ where: { id: found.id }, data: rate });
      } else {
        await prisma.shippingRate.create({ data: { ...rate, zoneId: record.id } });
      }
    }
  }
}

async function seedCoupons() {
  const coupons = [
    {
      code: 'CLUB10', description: '10% para clubes federados', type: 'PERCENT' as const,
      value: 10, minSubtotal: 250000, active: true,
    },
    {
      code: 'PRIMERACARRERA', description: '$15.000 en tu primera compra', type: 'FIXED' as const,
      value: 15000, minSubtotal: 100000, perUserLimit: 1, active: true,
    },
    {
      code: 'ENVIOGRATIS', description: 'Despacho sin costo', type: 'FREE_SHIPPING' as const,
      value: 0, minSubtotal: 80000, active: true,
    },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({ where: { code: c.code }, create: c, update: c });
  }
}

async function seedPosts() {
  const posts = [
    {
      slug: 'como-elegir-la-talla-de-tu-traje-de-competicion',
      title: 'Cómo elegir la talla de tu traje de competición',
      excerpt:
        'La talla es el error más caro del rubro. Esta es la forma correcta de medirse y por qué un traje de carrera se usa una o dos tallas más abajo.',
      tags: ['Guías', 'Tallas'],
      accent: '#00E0B8',
      body: `## El traje de competición no se elige como un traje de entrenamiento

Un traje de carrera funciona por compresión. Si entra cómodo, no está haciendo su trabajo. Esa es la razón por la que un nadador que usa talla 32 en entrenamiento compite en 28 o 30.

## Cómo medirse bien

Necesitas una huincha de costurera y alguien que te ayude. Mídete **sin ropa gruesa**, de pie, relajado, sin contraer el abdomen.

- **Cintura:** en el punto más angosto del torso, sobre el ombligo.
- **Cadera:** en el punto más ancho del glúteo.
- **Pecho** (para knee suits): bajo las axilas, sobre la parte más ancha.
- **Estatura:** descalzo, contra la pared.

Con esos tres números entras a la tabla de tallas de la ficha de cada producto y obtienes tu **talla de cuerpo**.

## Y ahora baja una o dos tallas

Sobre la talla de cuerpo aplicas el ajuste de competencia:

| Prueba | Ajuste |
| --- | --- |
| 50 y 100 metros | Baja 2 tallas |
| 200 y 400 metros | Baja 1 a 2 tallas |
| 800, 1500 y aguas abiertas | Baja 1 talla |
| Primer traje de carrera (juvenil) | Baja 1 talla |

Si es el primer traje de competencia del nadador, baja solo una. La diferencia entre un traje que comprime y uno que asfixia es real, y en un nadador de 12 o 13 años conviene no exagerar.

## Cómo ponerse el traje

Este es el segundo error más caro: la mayoría de las roturas de traje ocurre al ponérselo, no nadando.

1. Ponte las uñas cortas o usa guantes de algodón.
2. Entra con una pierna a la vez, subiendo el tejido de a poco con las **palmas abiertas**, nunca con las yemas ni las uñas.
3. Sube en tramos de cinco centímetros, alternando lados.
4. Reserva entre 10 y 15 minutos la primera vez.

## Cuánto dura

Un traje de competición bien cuidado rinde entre 25 y 30 carreras. Enjuágalo con agua fría inmediatamente después de cada uso, sécalo a la sombra extendido, y nunca lo dejes enrollado dentro del bolso.

¿Dudas con una talla puntual? Escríbenos por WhatsApp con las medidas del nadador y te decimos exactamente qué pedir.`,
    },
    {
      slug: 'que-significa-la-homologacion-world-aquatics',
      title: 'Qué significa realmente la homologación World Aquatics',
      excerpt:
        'Un código de homologación no es un sello de marketing: es un registro verificable que determina si el nadador puede competir o queda descalificado.',
      tags: ['Normativa', 'Competencia'],
      accent: '#4B9BF0',
      body: `## El código que decide si puedes competir

Cada traje aprobado para competencia oficial tiene un código de homologación de World Aquatics —el ente que antes se llamaba FINA—. Ese código aparece impreso en el traje y está publicado en la lista oficial de trajes aprobados.

Nuestros modelos:

- **R-SKIN Jammer (TS703)** — TA146514
- **R-SKIN Knee Suit (TS704)** — TA224135
- **VEL-SKIN Jammer (TS705)** — TA148911
- **VEL-SKIN Knee Suit (TS706)** — TA228496

## Por qué importa

En un campeonato nacional o clasificatorio, el juez árbitro puede pedir revisar el traje antes de la salida. Si el traje no tiene código, o el código no aparece en la lista oficial, el nadador **no larga**. No hay apelación posible en ese momento.

Esto pasa más de lo que se cree con trajes comprados por marketplaces internacionales, donde se venden réplicas o modelos descontinuados que perdieron su aprobación.

## Qué controla la normativa

La homologación no evalúa "calidad" en abstracto. Verifica requisitos concretos:

- **Espesor máximo** del material.
- **Flotabilidad:** el traje no puede aportar empuje adicional.
- **Permeabilidad** del tejido.
- **Cobertura:** hombre, del ombligo a la rodilla; mujer, sin cubrir cuello ni pasar del hombro y la rodilla.
- **Sin elementos externos:** cierres, broches o piezas rígidas están prohibidos.

## Cómo verificarlo tú mismo

No confíes en que la tienda te lo diga —incluidos nosotros—. Entra a la lista oficial de trajes aprobados de World Aquatics y busca el código. Debe aparecer el fabricante, el modelo y el año de aprobación.

En cada ficha de producto publicamos el código completo y el enlace directo a la base oficial, precisamente para que cualquier entrenador pueda comprobarlo antes de comprar.`,
    },
    {
      slug: 'taupoc-chile-calendario-torneos-y-stands',
      title: 'Dónde encontrarnos: calendario de torneos y stands',
      excerpt:
        'Estamos presentes con stand en los principales torneos del calendario nacional. Puedes probarte tallas, retirar pedidos web y comprar en el momento.',
      tags: ['Comunidad', 'Torneos'],
      accent: '#A46BFF',
      body: `## Probarse antes de comprar

Sabemos que comprar un traje de competición sin probarlo genera dudas. Por eso estamos con stand en los torneos del calendario nacional, con el muestrario completo de tallas de las líneas R-SKIN.

En el stand puedes:

- **Probarte tallas** con asesoría de talla incluida.
- **Retirar pedidos web** sin costo de despacho: elige "Entrega en torneo" al momento de pagar.
- **Comprar en el momento**, con las mismas condiciones y precios de la tienda online.

## Cómo coordinar un retiro en torneo

Al finalizar la compra, en el paso de despacho elige **Entrega en torneo**. Después te contactamos por WhatsApp para confirmar en qué fecha y en qué sede te lo entregamos.

## Clubes

Si representas a un club y quieres que llevemos un muestrario específico a tu sede o a un torneo puntual, escríbenos desde la sección de clubes. Trabajamos con condiciones especiales por volumen a partir de 10 unidades.`,
    },
  ];

  for (const p of posts) {
    const cover = await generateWideImage({
      name: p.title.slice(0, 34),
      hex: p.accent,
      caption: p.tags.join(' · '),
      width: 1600,
      height: 900,
      folder: 'blog',
    });
    const data = {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      body: p.body,
      tags: p.tags,
      coverUrl: cover.url,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(),
      seoTitle: p.title,
      seoDescription: p.excerpt,
    };
    await prisma.post.upsert({ where: { slug: p.slug }, create: data, update: data });
  }
}

async function seedSettings() {
  const settings = {
    storeName: 'TAUPOC Chile',
    tagline: 'Distribuidor oficial en Chile',
    contactEmail: 'hola@taupoc.cl',
    contactPhone: '+56 9 5555 5555',
    whatsapp: '+56955555555',
    instagram: 'taupoc.chile',
    addressLine: 'Providencia, Santiago',
    freeShippingOver: 150000,
    lowStockThreshold: 1,
    installmentsMax: 12,
    announcementBar: 'Despacho a todo Chile · Envío gratis sobre {envio_gratis}',
    announcementActive: true,
    gaMeasurementId: '',
    metaPixelId: '',
    gtmId: '',
    notifyOrderEmail: true,
    notifyAdminNewOrder: true,
    notifyLowStock: true,
  };

  await prisma.setting.upsert({
    where: { key: 'site' },
    create: { key: 'site', value: settings },
    update: { value: settings },
  });
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@taupoc.cl';
  const password = process.env.SEED_ADMIN_PASSWORD || 'taupoc2024';
  const passwordHash = await bcrypt.hash(password, 11);

  await prisma.user.upsert({
    where: { email },
    create: { email, name: 'Administrador', passwordHash, role: 'ADMIN' },
    update: { role: 'ADMIN' },
  });
  console.log(`  · Admin: ${email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`  · Contraseña por defecto: ${password}  ← cámbiala al primer ingreso`);
  }
}

async function main() {
  console.log('Poblando TAUPOC Chile...');
  await seedLines();
  await seedCategories();
  console.log('Catálogo:');
  await seedProducts();
  await seedShipping();
  await seedCoupons();
  await seedPosts();
  await seedSettings();
  await seedAdmin();

  const variants = await prisma.variant.count();
  const inStock = await prisma.variant.count({ where: { stock: { gt: 0 } } });
  const units = await prisma.variant.aggregate({ _sum: { stock: true } });
  console.log(`\nListo. ${variants} SKU · ${inStock} con stock · ${units._sum.stock ?? 0} unidades.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
