import type { Landing } from './landings';

/**
 * Páginas para la búsqueda desde otros países de Latinoamérica.
 *
 * La tienda es una sola, en español y en pesos chilenos; lo que cambia por
 * país es cómo se busca el producto. En Argentina es "malla", en Colombia
 * "vestido de baño", en Ecuador "terno de baño". Cada país tiene su página con
 * ese vocabulario, el envío y el pago explicados para quien compra desde
 * afuera, y los mismos productos. Chile no pasa por acá: sus páginas siguen
 * siendo las de src/lib/landings.ts.
 *
 * No se prometen plazos, tarifas ni impuestos por país: los cotiza Envía en
 * el checkout con la dirección real, y la aduana de cada país aplica lo suyo.
 */

export interface Country {
  slug: string;
  /** ISO 3166-1 alfa-2, el mismo que usa el checkout. */
  code: string;
  name: string;
  /** "a Perú", "a la República Dominicana". */
  toName: string;
  /** Cómo se le dice al traje de baño en el país, en singular. */
  term: string;
  termPlural: string;
  /** Otras formas en que se busca, para el texto y el FAQ. */
  alsoSearched: string[];
  /** Ciudades con más natación competitiva, para el texto. */
  cities: string[];
}

export const COUNTRIES: Country[] = [
  {
    slug: 'peru',
    code: 'PE',
    name: 'Perú',
    toName: 'a Perú',
    term: 'ropa de baño de competencia',
    termPlural: 'ropas de baño de competencia',
    alsoSearched: ['traje de baño de competencia', 'bañador de competencia'],
    cities: ['Lima', 'Arequipa', 'Trujillo'],
  },
  {
    slug: 'argentina',
    code: 'AR',
    name: 'Argentina',
    toName: 'a Argentina',
    term: 'malla de competición',
    termPlural: 'mallas de competición',
    alsoSearched: ['malla de natación', 'malla enteriza de competición'],
    cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza'],
  },
  {
    slug: 'colombia',
    code: 'CO',
    name: 'Colombia',
    toName: 'a Colombia',
    term: 'vestido de baño de competencia',
    termPlural: 'vestidos de baño de competencia',
    alsoSearched: ['traje de baño de competencia', 'vestido de natación'],
    cities: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla'],
  },
  {
    slug: 'mexico',
    code: 'MX',
    name: 'México',
    toName: 'a México',
    term: 'traje de baño de competencia',
    termPlural: 'trajes de baño de competencia',
    alsoSearched: ['traje de natación de competencia', 'bañador de competencia'],
    cities: ['Ciudad de México', 'Guadalajara', 'Monterrey'],
  },
  {
    slug: 'ecuador',
    code: 'EC',
    name: 'Ecuador',
    toName: 'a Ecuador',
    term: 'terno de baño de competencia',
    termPlural: 'ternos de baño de competencia',
    alsoSearched: ['traje de baño de competencia', 'ropa de baño de natación'],
    cities: ['Quito', 'Guayaquil', 'Cuenca'],
  },
  {
    slug: 'bolivia',
    code: 'BO',
    name: 'Bolivia',
    toName: 'a Bolivia',
    term: 'malla de competencia',
    termPlural: 'mallas de competencia',
    alsoSearched: ['traje de baño de competencia', 'ropa de baño de natación'],
    cities: ['Santa Cruz', 'La Paz', 'Cochabamba'],
  },
  {
    slug: 'uruguay',
    code: 'UY',
    name: 'Uruguay',
    toName: 'a Uruguay',
    term: 'malla de competición',
    termPlural: 'mallas de competición',
    alsoSearched: ['malla de natación', 'malla enteriza'],
    cities: ['Montevideo', 'Punta del Este'],
  },
  {
    slug: 'paraguay',
    code: 'PY',
    name: 'Paraguay',
    toName: 'a Paraguay',
    term: 'malla de competición',
    termPlural: 'mallas de competición',
    alsoSearched: ['traje de baño de competencia', 'malla de natación'],
    cities: ['Asunción', 'Ciudad del Este'],
  },
  {
    slug: 'costa-rica',
    code: 'CR',
    name: 'Costa Rica',
    toName: 'a Costa Rica',
    term: 'vestido de baño de competencia',
    termPlural: 'vestidos de baño de competencia',
    alsoSearched: ['traje de baño de competencia', 'vestido de natación'],
    cities: ['San José', 'Heredia', 'Alajuela'],
  },
  {
    slug: 'panama',
    code: 'PA',
    name: 'Panamá',
    toName: 'a Panamá',
    term: 'vestido de baño de competencia',
    termPlural: 'vestidos de baño de competencia',
    alsoSearched: ['traje de baño de competencia', 'traje de natación'],
    cities: ['Ciudad de Panamá', 'David'],
  },
  {
    slug: 'guatemala',
    code: 'GT',
    name: 'Guatemala',
    toName: 'a Guatemala',
    term: 'traje de baño de competencia',
    termPlural: 'trajes de baño de competencia',
    alsoSearched: ['traje de natación', 'calzoneta de competencia'],
    cities: ['Ciudad de Guatemala', 'Quetzaltenango'],
  },
  {
    slug: 'republica-dominicana',
    code: 'DO',
    name: 'República Dominicana',
    toName: 'a República Dominicana',
    term: 'traje de baño de competencia',
    termPlural: 'trajes de baño de competencia',
    alsoSearched: ['traje de natación de competencia', 'bañador de competencia'],
    cities: ['Santo Domingo', 'Santiago de los Caballeros'],
  },
];

export const INTERNATIONAL_PATH = '/envios-internacionales';

export function countryPath(c: Country): string {
  return `${INTERNATIONAL_PATH}/${c.slug}`;
}

export function countryBySlug(slug: string): Country | undefined {
  return COUNTRIES.find((c) => c.slug === slug);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Página de cada país, con la misma plantilla que las landings de Chile. */
export function countryLanding(c: Country): Landing {
  const otros = c.alsoSearched.join(' o ');
  return {
    path: countryPath(c),
    title: `${capitalize(c.term)} con envío ${c.toName} · Homologada World Aquatics`,
    description:
      `${capitalize(c.termPlural)} TAUPOC homologados por World Aquatics, con envío ${c.toName} por FedEx o DHL ` +
      'y pago en dólares con PayPal. Jammers y knee suits, tallas 20 a 36.',
    eyebrow: `Envíos ${c.toName}`,
    h1: `${capitalize(c.term)} con envío ${c.toName}`,
    intro:
      `Jammers para hombre y knee suits para mujer TAUPOC, homologados por World Aquatics, con despacho ` +
      `${c.toName} desde Chile. Si buscas ${c.term}, ${otros} o un fast skin para competir en ` +
      `${c.cities.join(', ')} o cualquier ciudad de ${c.name}, compras acá mismo: el envío se cotiza con tu ` +
      'dirección y pagas en dólares con PayPal.',
    productsTitle: `${capitalize(c.termPlural)} disponibles para enviar ${c.toName}`,
    priceNote: `Precios en pesos chilenos; en el checkout ves el total en dólares · Envío ${c.toName} por FedEx o DHL`,
    parent: { name: 'Envíos internacionales', href: INTERNATIONAL_PATH },
    sections: [
      {
        title: `Cómo llega tu pedido ${c.toName}`,
        paragraphs: [
          `Al elegir ${c.name} como país de destino en el checkout, cotizamos el envío con las paqueterías ` +
            `internacionales que despachan ${c.toName} (FedEx y DHL, según tu dirección) y ves cada opción con ` +
            'su precio y plazo estimado antes de pagar.',
          'El pedido sale desde Santiago de Chile con número de seguimiento, que te llega por correo apenas lo ' +
            'despachamos.',
        ],
        bullets: [
          'Busca tu dirección o escríbela con tu código postal.',
          'Elige la paquetería: la más económica viene marcada.',
          'Paga con PayPal, con tu cuenta o con tarjeta de crédito o débito.',
        ],
      },
      {
        title: 'Pago en dólares con PayPal',
        paragraphs: [
          `Los precios de la tienda están en pesos chilenos. Para compras ${c.toName} el total se convierte a ` +
            'dólares estadounidenses y se cobra con PayPal: antes de pagar ves exactamente cuántos dólares se te ' +
            'cobran.',
          'No necesitas cuenta en Chile ni tarjeta chilena. PayPal acepta tarjetas de crédito y débito ' +
            'internacionales.',
        ],
      },
      {
        title: `${capitalize(c.term)} homologada para competir`,
        paragraphs: [
          'Todos los modelos de competición TAUPOC están en la lista de trajes aprobados de World Aquatics, la ' +
            'norma que exigen las competencias federadas. Cada ficha muestra el código de aprobación del modelo.',
          'Jammer para hombre, de la cintura a la rodilla; knee suit para mujer, del hombro a la rodilla. Tejido ' +
            'técnico de baja absorción de agua y costuras termoselladas.',
        ],
      },
      {
        title: 'Impuestos y aduana',
        paragraphs: [
          `El precio del envío no incluye impuestos ni aranceles de importación de ${c.name}. Si corresponden, ` +
            'los cobra la aduana o la paquetería al momento de la entrega, según las reglas del país.',
        ],
      },
    ],
    faq: [
      {
        q: `¿Hacen envíos ${c.toName}?`,
        a:
          `Sí. Despachamos ${c.toName} desde Chile con FedEx o DHL. En el checkout eliges ${c.name} como país ` +
          'de destino y ves las opciones disponibles para tu dirección.',
      },
      {
        q: `¿Cuánto cuesta el envío ${c.toName}?`,
        a:
          'Depende de la ciudad, el código postal y el peso del pedido. Se cotiza en línea con tu dirección y ves ' +
          'el precio de cada paquetería antes de pagar, sin cargos sorpresa en la tienda.',
      },
      {
        q: `¿Cómo pago desde ${c.name}?`,
        a:
          'Con PayPal, en dólares estadounidenses. Puedes pagar con tu cuenta PayPal o con una tarjeta de crédito ' +
          'o débito internacional.',
      },
      {
        q: `¿La ${c.term} sirve para torneos?`,
        a:
          'Sí, los modelos de competición TAUPOC están aprobados por World Aquatics. El código de aprobación de ' +
          'cada modelo aparece en su ficha.',
      },
      {
        q: '¿Tengo que pagar impuestos al recibirlo?',
        a:
          `Puede ser. Los impuestos y aranceles de importación los define ${c.name} y los cobra la aduana o la ` +
          'paquetería en la entrega. No están incluidos en el precio del envío.',
      },
      {
        q: '¿Cómo elijo la talla?',
        a:
          'Con la guía de tallas: mide cintura, cadera y estatura y busca tu talla. Si tienes dudas, escríbenos ' +
          'antes de comprar y te asesoramos.',
      },
    ],
    related: [INTERNATIONAL_PATH, '/guia-de-tallas', '/fast-skin', '/como-ponerse-un-traje-de-competencia'],
  };
}

/** Página general de envíos internacionales, que enlaza a cada país. */
export const INTERNATIONAL_LANDING: Landing = {
  path: INTERNATIONAL_PATH,
  title: 'Trajes de baño de competencia con envío a Latinoamérica',
  description:
    'Trajes de baño de competencia TAUPOC homologados por World Aquatics con envío a Perú, Argentina, Colombia, ' +
    'México, Ecuador y toda Latinoamérica. Pago en dólares con PayPal.',
  eyebrow: 'Envíos internacionales',
  h1: 'Trajes de competencia con envío a toda Latinoamérica',
  intro:
    'Jammers y knee suits TAUPOC homologados por World Aquatics, despachados desde Chile a Perú, Argentina, ' +
    'Colombia, México, Ecuador y el resto de Latinoamérica. El envío se cotiza con tu dirección y pagas en ' +
    'dólares con PayPal.',
  productsTitle: 'Trajes de competencia disponibles para envío internacional',
  priceNote: 'Precios en pesos chilenos; en el checkout ves el total en dólares · Envío por FedEx o DHL',
  sections: [
    {
      title: 'Cómo comprar desde fuera de Chile',
      paragraphs: [
        'Compras en la misma tienda. En el checkout eliges tu país, buscas tu dirección y cotizamos el envío con ' +
          'las paqueterías internacionales que despachan a tu ciudad.',
      ],
      bullets: [
        'Envío por FedEx o DHL, con número de seguimiento.',
        'Pago en dólares con PayPal: cuenta PayPal o tarjeta internacional.',
        'Ves el precio y el plazo de cada paquetería antes de pagar.',
      ],
    },
    {
      title: 'Países a los que despachamos',
      paragraphs: [
        'Despachamos a cualquier país donde operen nuestras paqueterías. Estas son las guías de los países desde ' +
          'donde más nos escriben:',
      ],
      bullets: COUNTRIES.map((c) => `${c.name}: ${c.term}`),
    },
  ],
  faq: [
    {
      q: '¿A qué países envían?',
      a:
        'A toda Latinoamérica y a otros países donde operan FedEx y DHL. En el checkout eliges tu país y ves si ' +
        'hay opciones para tu dirección.',
    },
    {
      q: '¿En qué moneda pago?',
      a: 'En dólares estadounidenses, con PayPal. Antes de pagar ves el total exacto en dólares.',
    },
    {
      q: '¿El envío incluye impuestos de importación?',
      a:
        'No. Si tu país cobra impuestos o aranceles de importación, los cobra la aduana o la paquetería al ' +
        'entregar el pedido.',
    },
  ],
  related: COUNTRIES.map(countryPath),
};

/** Etiquetas de los enlaces entre páginas, para "También te puede servir". */
export const INTERNATIONAL_LINKS: Record<string, string> = {
  [INTERNATIONAL_PATH]: 'Envíos a Latinoamérica',
  ...Object.fromEntries(COUNTRIES.map((c) => [countryPath(c), `Envíos ${c.toName}`])),
};
