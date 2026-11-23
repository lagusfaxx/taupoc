import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { generateWideImage } from './placeholder-images';

/**
 * Notas del blog que se publican sobre una tienda ya en uso.
 *
 * El seed no corre con catálogo cargado, así que las notas nuevas entran por
 * aquí. Cada una se crea solo si su slug no existe: si el dueño la edita o la
 * despublica desde el panel, volver a desplegar no la pisa.
 */
const prisma = new PrismaClient();

interface NewPost {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  accent: string;
  publishedAt: string;
  body: string;
}

const POSTS: NewPost[] = [
  {
    slug: 'novedades-taupoc-chile-fin-de-ano-2026',
    title: 'Novedades TAUPOC Chile: sorteo, ofertas por talla y venta por mayor',
    excerpt:
      'Lo que cambió en la tienda esta temporada: el sorteo de un R-SKIN, ofertas por talla, tallas a pedido y una nueva sección para tiendas que quieren vender TAUPOC.',
    tags: ['Novedades', 'Comunidad'],
    accent: '#00E0B8',
    publishedAt: '2026-11-20T12:00:00-03:00',
    body: `## Un cierre de año con varias novedades

Desde que abrimos la tienda online fuimos sumando cosas que nos pedían nadadores, apoderados y entrenadores. Este es el resumen de lo más importante.

## Sorteo de un R-SKIN

En octubre sorteamos un traje **R-SKIN** entre quienes participaron en Instagram. El ganador se anunció en vivo el 28 de octubre y el resultado quedó publicado en la página del [sorteo](/sorteo). Gracias a todos los que participaron y etiquetaron a sus compañeros de equipo. Atento a nuestro Instagram para el próximo.

## Ofertas por talla

Algunas tallas puntuales ahora tienen precio rebajado. Las verás marcadas con un badge rojo con el porcentaje de descuento y la talla en oferta escrita al lado. Son unidades limitadas y no se acumulan con cupones, así que si tu talla aparece en oferta, es el momento.

## Tallas a pedido

Si tu talla no está en stock, en la ficha del producto aparece un botón de WhatsApp para pedirla. Te confirmamos disponibilidad y plazo antes de que pagues.

## Comparador R-SKIN o VEL-SKIN

¿No sabes qué línea elegir? En [R-SKIN o VEL-SKIN](/lineas) comparamos las dos líneas dato a dato: compresión, material, para qué distancias conviene cada una y precio.

## Nueva sección: venta por mayor

Si tienes una tienda deportiva o de natación, ahora puedes pedir nuestra lista de precios mayorista desde [Venta por mayor](/venta-por-mayor). Puedes mezclar modelos, colores y tallas en el mismo pedido, despachamos a todo Chile con factura y te pasamos fotos y fichas para tu catálogo.

¿Compras para un club? La cotización por volumen para equipos sigue en [Clubes](/clubes), desde 10 unidades.`,
  },
  {
    slug: 'resumen-temporada-natacion-chile-octubre-noviembre-2026',
    title: 'Lo que pasó en la natación chilena: Copa Pacífico, Copa Chile y aguas abiertas',
    excerpt:
      'Chile campeón de la Copa Pacífico, la tercera fecha de la Copa Chile en el Centro Acuático Kristel Köbrich y un noviembre cargado de aguas abiertas en el sur.',
    tags: ['Resultados', 'Competencia'],
    accent: '#4B9BF0',
    publishedAt: '2026-11-22T20:00:00-03:00',
    body: `## Chile, campeón de la Copa Pacífico 2026

Entre el 22 y el 25 de octubre se disputó la Copa Pacífico de natación clásica y Chile se quedó con el título, un resultado calificado como histórico por la prensa especializada. Es una de las mejores noticias de la temporada.

## Copa Chile 3: Estadio Mayor y Global Team, campeones

La tercera fecha de la Copa Chile se nadó el 21 y 22 de noviembre en el **Centro Acuático Kristel Köbrich**. Estadio Mayor y Global Team terminaron como campeones. Con esta fecha cierra el circuito de Copa Chile del año y la atención pasa al Open de Clausura de diciembre.

## Másters chilenos en el Panamericano de Buenos Aires

Los clubes chilenos volvieron del PanamAquatics Másters de Buenos Aires con más de 80 medallas en natación.

## Noviembre en aguas abiertas

El sur concentró la actividad en aguas abiertas:

- **Desafío Aguas Abiertas Frutillar (15 de noviembre):** la segunda edición reunió a más de 200 nadadores en 1K y 2K en el Lago Llanquihue.
- **Cruce Puelche 8K (14 de noviembre):** cinco nadadores completaron el cruce.
- **Karen Rosas**, de Valdivia, completó 22 kilómetros de nado sin neopreno.

El **Campeonato Nacional de Aguas Abiertas Primavera**, que estaba fijado para el 6 al 8 de noviembre en Laguna Esmeralda, se reprogramó por el clima. Se estima que se nade en diciembre; la fecha y sede todavía no están confirmadas.

## Lo que viene

Revisa el calendario completo de diciembre y enero en nuestra nota [Torneos de natación en Chile hasta fin de año](/blog/calendario-natacion-chile-diciembre-2026-enero-2027).`,
  },
  {
    slug: 'calendario-natacion-chile-diciembre-2026-enero-2027',
    title: 'Torneos de natación en Chile hasta fin de año (y lo que viene en enero)',
    excerpt:
      'Nacional Máster, Open de Clausura, torneos máster en Arica y Santiago y los nacionales de enero: las fechas en Chile que tienes que anotar.',
    tags: ['Torneos', 'Calendario'],
    accent: '#A46BFF',
    publishedAt: '2026-11-23T10:00:00-03:00',
    body: `## Lo que queda de 2026 en Chile

Estos son los torneos de natación en Chile que quedan este año, según el calendario de FECHIDA y el de la Federación Chilena Máster. Las sedes y horarios se confirman antes de cada torneo: revísalos en fechida.cl y fchmn.cl antes de viajar.

| Fecha | Torneo | Ciudad |
|---|---|---|
| 26 al 29 de noviembre | Nacional Máster (Primavera) | Por confirmar |
| 4 al 6 de diciembre | Natación Sin Fronteras (máster, piscina 50 m) | Arica |
| 10 al 13 de diciembre | **Open de Clausura** | Por confirmar |
| 12 de diciembre | XII Copa Natación Recoleta (máster, piscina 25 m) | Santiago |
| Diciembre, por confirmar | Nacional de Aguas Abiertas Primavera (reprogramado) | Por confirmar |

El **Open de Clausura** es el último gran torneo nacional del año en piscina y el objetivo de temporada de muchos nadadores. Si vas a estrenar traje ahí, cómpralo con tiempo: un traje de competición conviene usarlo al menos una vez antes de la carrera importante para conocer cómo se pone y cómo calza.

## Enero 2027: temporada de nacionales

| Fecha | Torneo |
|---|---|
| 6 al 9 de enero | XXI Campeonato Nacional de Natación Máster |
| 9 y 10 de enero | Festival de Menores |
| 15 al 17 de enero | Nacional de Desarrollo |
| 21 al 24 de enero | Nacional Infantil |
| 27 al 31 de enero | Nacional de Categorías |

Para quienes nadan en categorías infantiles y juveniles, enero es el mes más importante. Revisa nuestras [tallas juveniles](/trajes-de-competencia-juveniles) y confirma que el traje esté homologado por World Aquatics: en un nacional el juez puede revisarlo antes de la salida.

## Aguas abiertas

Las inscripciones para el **Desafío de Los Lagos 2027** abrieron el 20 de noviembre. El Nacional de Aguas Abiertas Primavera, que se suspendió en noviembre por el clima, debería nadarse en diciembre; la federación aún no confirma fecha ni sede.

## Antes de cada torneo

1. **Prueba el traje en un entrenamiento**, nunca por primera vez el día de la carrera.
2. Llévalo en una bolsa plana, no enrollado.
3. Reserva 10 a 15 minutos para ponértelo; con las palmas, nunca con las uñas.
4. Enjuágalo con agua fría apenas termines.

¿Dudas con la talla antes del Open de Clausura o de los nacionales de enero? Escríbenos por WhatsApp con las medidas del nadador y te decimos qué pedir. Si representas a un club y quieren competir todos con el mismo traje, cotiza en [Clubes](/clubes).`,
  },
  {
    slug: 'regalos-de-navidad-para-nadadores',
    title: 'Regalos de Navidad para nadadores: qué elegir según su nivel',
    excerpt:
      'Una guía corta para apoderados y familiares: qué traje regalar según la edad y el nivel del nadador, y cómo acertar con la talla sin preguntarle.',
    tags: ['Guías', 'Navidad'],
    accent: '#FF5C7A',
    publishedAt: '2026-11-23T12:00:00-03:00',
    body: `## Un regalo que sí se usa

Para un nadador que compite, un traje de competición homologado es de los regalos más útiles: lo va a usar en los torneos de diciembre y en los nacionales de enero.

## Según el nivel

- **Primeros torneos y categorías infantiles:** un traje de entrada homologado basta. Busca en [juveniles](/trajes-de-competencia-juveniles) las tallas 20 a 24.
- **Nadador federado que ya compite en nacionales:** la línea **R-SKIN** es la más elegida para el día a día de competencia.
- **Finales y marcas mínimas:** la línea **VEL-SKIN**, de mayor compresión. Si dudas entre las dos, mira el [comparador](/lineas).

## Cómo acertar con la talla sin preguntar

La talla de un traje de competición no es la de la ropa. Lo más seguro:

1. Pide prestado el traje que usa hoy y revisa la talla en la etiqueta.
2. Si no puedes, mide cintura y cadera con una huincha mientras duerme la siesta (en serio, funciona) y usa la [guía de tallas](/guia-de-tallas).
3. Si quedas entre dos tallas, escríbenos por WhatsApp antes de comprar.

## Plazos

Revisa los plazos de despacho a tu ciudad en [Envíos](/envios) y compra con margen: diciembre es el mes con más pedidos del año.`,
  },
];

async function main() {
  for (const p of POSTS) {
    const existe = await prisma.post.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (existe) {
      console.log(`· ${p.slug} ya existe, no se toca`);
      continue;
    }
    const cover = await generateWideImage({
      name: p.title.slice(0, 34),
      hex: p.accent,
      caption: p.tags.join(' · '),
      width: 1600,
      height: 900,
      folder: 'blog',
    });
    await prisma.post.create({
      data: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        body: p.body,
        tags: p.tags,
        coverUrl: cover.url,
        status: 'PUBLISHED',
        publishedAt: new Date(p.publishedAt),
        seoTitle: p.title,
        seoDescription: p.excerpt,
      },
    });
    console.log(`· ${p.slug} publicada`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
