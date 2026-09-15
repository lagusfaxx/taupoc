import type { PrismaClient } from '@prisma/client';

/**
 * Las líneas de producto y su comparador, aparte del seed.
 *
 * El seed es una carga inicial y no toca una tienda que ya tiene catálogo, así
 * que todo lo que se agregue después —el escalón de gama, el sello y las filas
 * del comparador— nunca llegaría a una tienda en uso. Esto se puede aplicar
 * solo, sin pisar productos, fotos, stock ni precios:
 *
 *     npm run db:lines
 *
 * El despliegue lo corre en cada arranque, después de las migraciones.
 */
/**
 * Las dos líneas de traje comparten estas filas, con la misma etiqueta y en el
 * mismo orden, para que el comparador de la ficha las enfrente una a una.
 *
 * VEL-SKIN no gana en todo a propósito: dura menos y cuesta más ponérselo. Es
 * la diferencia real entre un traje de temporada y uno de final, y decirla es
 * lo que hace creíble la que sí es una ventaja.
 */
const LINE_METRICS: Record<'r-skin' | 'vel-skin', { label: string; value: string; score: number; note?: string }[]> = {
  'r-skin': [
    { label: 'Peso (talla 28)', value: '170 g', score: 68 },
    { label: 'Compresión del core', value: 'Alta', score: 72, note: 'Compresión pareja en cintura y muslo.' },
    { label: 'Absorción de agua (30 min)', value: '4,5%', score: 70 },
    { label: 'Retorno elástico', value: '92%', score: 78 },
    { label: 'Vida útil en competencia', value: '25 a 30 carreras', score: 95 },
    { label: 'Tiempo de puesta', value: '10 a 15 min', score: 85 },
  ],
  'vel-skin': [
    { label: 'Peso (talla 28)', value: '150 g', score: 100, note: '12% más liviano que R-SKIN.' },
    { label: 'Compresión del core', value: 'Muy alta', score: 100, note: 'Malla de tracción sobre el eje longitudinal.' },
    { label: 'Absorción de agua (30 min)', value: '2,1%', score: 96 },
    { label: 'Retorno elástico', value: '97%', score: 97 },
    { label: 'Vida útil en competencia', value: '18 a 22 carreras', score: 60, note: 'El tejido ultraliviano se cansa antes.' },
    { label: 'Tiempo de puesta', value: '15 a 20 min', score: 55, note: 'Entra más justo: date el tiempo antes de la serie.' },
  ],
};

export async function applyLines(prisma: PrismaClient) {
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
      tier: 1,
      tierLabel: 'Serie Competición',
      cardClaim: '170 g · 25 a 30 carreras · 15 colorways',
      bestFor:
        'Para el nadador que compite toda la temporada y necesita un traje que aguante el calendario completo: ' +
        'clasificatorios, nacionales y torneos de club con el mismo traje.',
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
      tier: 2,
      tierLabel: 'Serie Élite',
      cardClaim: '150 g · 2,1% de absorción · para la final',
      bestFor:
        'Para la final, el récord y el campeonato objetivo. Se compra para las carreras que importan: entrega más ' +
        'por brazada, pero se guarda para esas y dura menos que el R-SKIN.',
    },
    {
      slug: 'accesorios',
      name: 'Accesorios',
      tagline: 'Gorros, antiparras y equipamiento',
      description: 'Gorros de silicona de baja resistencia, antiparras de competición y mochilas técnicas.',
      accentHex: '#4B9BF0',
      sortOrder: 3,
      tier: 0,
      tierLabel: null,
      bestFor: null,
      cardClaim: null,
    },
  ];
  for (const line of lines) {
    const guardada = await prisma.productLine.upsert({
      where: { slug: line.slug },
      create: line,
      update: line,
    });

    const metrics = LINE_METRICS[line.slug as 'r-skin' | 'vel-skin'];
    if (!metrics) continue;

    // Se reescriben enteras: si una fila se saca del comparador, tiene que
    // desaparecer también de la línea que ya la tenía, o quedaría una fila
    // huérfana enfrentada a nada.
    await prisma.lineMetric.deleteMany({
      where: { lineId: guardada.id, label: { notIn: metrics.map((m) => m.label) } },
    });
    for (const [i, metric] of metrics.entries()) {
      const data = { ...metric, note: metric.note ?? null, sortOrder: i + 1 };
      await prisma.lineMetric.upsert({
        where: { lineId_label: { lineId: guardada.id, label: metric.label } },
        create: { ...data, lineId: guardada.id },
        update: data,
      });
    }
  }
}
