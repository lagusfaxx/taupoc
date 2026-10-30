import type { Metadata } from 'next';
import { intlIndexable, storeSiteUrl } from './storefront';

/*
 * Metadatos de taupoc.lat.
 *
 * - Canónica siempre a taupoc.lat.
 * - hreflang es-CL ↔ es-419 cuando la página tiene una equivalente en
 *   taupoc.cl (misma ruta), con x-default en taupoc.lat. taupoc.cl publica el
 *   par inverso recién en el lanzamiento, cuando esta tienda se abre a los
 *   buscadores: antes apuntaría a páginas con noindex.
 * - Ningún título ni descripción dice "Chile": Chile es desde donde se
 *   despacha, no lo que es la marca. Si un texto lo trae, se reemplaza por el
 *   de respaldo y queda en el log para corregirlo.
 */

const SITE_NAME = 'TAUPOC';
const MENTIONS_CHILE = /chile|chilen/i;

function clean(text: string, fallback: string, field: string): string {
  if (!MENTIONS_CHILE.test(text)) return text;
  console.warn(`[intl-seo] ${field} menciona Chile y se reemplazó: "${text}"`);
  return fallback;
}

export function intlUrl(path = '/'): string {
  return `${storeSiteUrl('INTL')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function intlMetadata(params: {
  title: string;
  /** Título completo, sin el " · TAUPOC" de la plantilla. */
  absoluteTitle?: boolean;
  description: string;
  path: string;
  /** Ruta equivalente en taupoc.cl, si existe. Activa hreflang. */
  clPath?: string;
  image?: string | null;
  noIndex?: boolean;
}): Metadata {
  const fallbackTitle = 'Trajes de competencia homologados World Aquatics';
  const fallbackDescription =
    'Trajes de competencia TAUPOC homologados por World Aquatics, con envío a toda Latinoamérica.';
  const title = clean(params.title, fallbackTitle, 'title');
  const description = clean(params.description, fallbackDescription, 'description');
  const url = intlUrl(params.path);
  const image = params.image ? intlUrl(params.image) : undefined;
  const index = intlIndexable() && !params.noIndex;

  return {
    title: params.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
      ...(params.clPath
        ? {
            languages: {
              'es-CL': `${storeSiteUrl('CL')}${params.clPath}`,
              'es-419': url,
              'x-default': url,
            },
          }
        : {}),
    },
    robots: index ? undefined : { index: false, follow: !params.noIndex && intlIndexable() },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'es_419',
      type: 'website',
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, ...(image ? { images: [image] } : {}) },
  };
}
