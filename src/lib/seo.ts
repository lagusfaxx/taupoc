import type { Metadata } from 'next';

export const SITE_NAME = 'TAUPOC Chile';
export const SITE_DESCRIPTION =
  'Distribuidor oficial TAUPOC en Chile. Trajes de competición homologados por World Aquatics, con despacho a todo el país.';

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function absoluteUrl(pathname = '/'): string {
  return `${siteUrl()}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

// La plantilla del layout raíz agrega esto al final de cada título.
const TITLE_SUFFIX = ` · ${SITE_NAME}`;
const TITLE_MAX = 60;

export function buildMetadata(params: {
  title: string;
  description?: string;
  path?: string;
  image?: string | null;
  type?: 'website' | 'article';
  noIndex?: boolean;
  /** Con `noIndex`: deja que los buscadores sigan los enlaces de la página. */
  follow?: boolean;
  publishedTime?: string;
}): Metadata {
  const url = absoluteUrl(params.path ?? '/');
  // Sin imagen propia se apunta a /api/og, que devuelve la que esté
  // configurada en el panel. La dirección es fija a propósito: las redes
  // guardan la vista previa por URL, y una que cambiara con cada ajuste
  // dejaría enlaces viejos apuntando a nada.
  const image = absoluteUrl(params.image ?? '/api/og');
  const description = params.description ?? SITE_DESCRIPTION;

  // Si con la marca el título pasa de lo que Google muestra, va sin ella: se
  // corta igual, y es mejor que se corte la marca que el nombre del producto.
  const title =
    params.title.length + TITLE_SUFFIX.length > TITLE_MAX ? { absolute: params.title } : params.title;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: params.noIndex ? { index: false, follow: params.follow ?? false } : undefined,
    openGraph: {
      title: params.title,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'es_CL',
      type: params.type ?? 'website',
      images: [{ url: image, width: 1200, height: 630, alt: params.title }],
      ...(params.publishedTime ? { publishedTime: params.publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: params.title,
      description,
      images: [image],
    },
  };
}

/** Inyecta JSON-LD. El contenido se serializa escapando `<` para evitar romper el script. */
export function jsonLd(data: object): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}
