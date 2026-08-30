import type { Metadata } from 'next';

export const SITE_NAME = 'TAUPOC Chile';
export const SITE_DESCRIPTION =
  'Distribuidor oficial TAUPOC en Chile. Trajes de competición homologados por World Aquatics, con stock real de tallas y despacho a todo el país.';

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function absoluteUrl(pathname = '/'): string {
  return `${siteUrl()}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

export function buildMetadata(params: {
  title: string;
  description?: string;
  path?: string;
  image?: string | null;
  type?: 'website' | 'article';
  noIndex?: boolean;
  publishedTime?: string;
}): Metadata {
  const url = absoluteUrl(params.path ?? '/');
  const image = params.image ? absoluteUrl(params.image) : absoluteUrl('/og-default.png');
  const description = params.description ?? SITE_DESCRIPTION;

  return {
    title: params.title,
    description,
    alternates: { canonical: url },
    robots: params.noIndex ? { index: false, follow: false } : undefined,
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
