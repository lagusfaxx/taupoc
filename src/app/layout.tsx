import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { headers } from 'next/headers';
import { getSettings } from '@/lib/settings';
import { metaPixelBootstrap } from '@/lib/meta-pixel';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/seo';
import { getStore } from '@/lib/storefront-server';
import { intlIndexable, storeSiteUrl } from '@/lib/storefront';
import './globals.css';

/*
 * Un solo layout raíz para las dos tiendas: cambia el idioma, el tema, las
 * fuentes y los metadatos según el dominio. taupoc.cl recibe exactamente lo
 * de siempre; lo propio de taupoc.lat vive en src/app/intl.
 */

const metadataCL: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — Trajes de baño de competencia homologados`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'traje de baño de competencia',
    'traje de baño de competencia mujer',
    'traje de baño de competencia hombre',
    'traje de baño de competencia para niña',
    'trajes de competición homologados World Aquatics',
    'fast skin',
    'fastskin',
    'fas skin',
    'fast skin de competencia',
    'fast skin hombre',
    'fast skin mujer',
    'jammer de competencia',
    'knee suit natación',
    'traje de natación de competencia Chile',
    'TAUPOC Chile',
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  formatDetection: { telephone: false },
  // Verificación de propiedad en Google Search Console. Next lo emite como
  // <meta name="google-site-verification">. Va en el layout raíz y no en
  // `buildMetadata`: las páginas no definen `verification`, así que lo
  // heredan y la etiqueta queda en todo el sitio, no solo en la portada.
  verification: { google: '_sZyWMARMexGYCxAaSz8Lj1y58Ux3A8lahiHRTvp0c4' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/icon.svg',
  },
};

// La tienda internacional no dice "Chile" en ningún título ni descripción:
// Chile es desde donde se despacha, no lo que es la marca.
const INTL_NAME = 'TAUPOC';
const INTL_DESCRIPTION =
  'Trajes de competencia TAUPOC homologados por World Aquatics. Jammers y knee suits con envío a toda Latinoamérica y pago en dólares.';

function metadataINTL(): Metadata {
  return {
    metadataBase: new URL(storeSiteUrl('INTL')),
    title: {
      default: `${INTL_NAME} — Trajes de competencia homologados World Aquatics`,
      template: `%s · ${INTL_NAME}`,
    },
    description: INTL_DESCRIPTION,
    applicationName: INTL_NAME,
    authors: [{ name: INTL_NAME }],
    creator: INTL_NAME,
    formatDetection: { telephone: false },
    // Hasta el lanzamiento ninguna página de taupoc.lat se indexa.
    robots: intlIndexable() ? undefined : { index: false, follow: false },
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
      apple: '/icon.svg',
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return (await getStore()) === 'INTL' ? metadataINTL() : metadataCL;
}

const viewportCL: Viewport = {
  themeColor: '#07090B',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

const viewportINTL: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
};

export async function generateViewport(): Promise<Viewport> {
  return (await getStore()) === 'INTL' ? viewportINTL : viewportCL;
}

const FONTS_CL =
  'https://fonts.googleapis.com/css2?family=Saira:wght@500;600;700;800;900&family=Barlow:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
const FONTS_INTL =
  'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&display=swap';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Leer la solicitud antes de los ajustes impide fijar el ID al compilar.
  const pathname = (await headers()).get('x-pathname') ?? '';
  const store = await getStore();
  const intl = store === 'INTL';
  const settings = await getSettings();
  const pixelId = settings.metaPixelId.trim();
  const pixelScript = pathname === '/admin' || pathname.startsWith('/admin/')
    ? null
    : metaPixelBootstrap(pixelId);

  return (
    <html lang={intl ? 'es-419' : 'es-CL'} className={intl ? undefined : 'dark'} data-store={intl ? 'intl' : undefined}>
      <head>
        {pixelScript ? <script id="meta-pixel" dangerouslySetInnerHTML={{ __html: pixelScript }} /> : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Hoja de estilos de fuentes cargada por enlace y no con next/font:
            así la compilación de la imagen Docker no depende de la red, y la
            pila de respaldo del sistema cubre el caso de fuentes bloqueadas. */}
        <link
          rel="stylesheet"
          href={intl ? FONTS_INTL : FONTS_CL}
        />
      </head>
      <body>
        {pixelScript ? (
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img height="1" width="1" style={{ display: 'none' }} alt=""
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} />
          </noscript>
        ) : null}
        <a
          href="#contenido"
          className={
            intl
              ? 'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-cobalt focus:px-4 focus:py-2 focus:text-sm focus:text-white'
              : 'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:accent-bg focus:px-4 focus:py-2 focus:font-display focus:text-xs focus:uppercase focus:tracking-widest'
          }
        >
          Saltar al contenido
        </a>

        {children}

        {/* Analítica de Google configurable desde el panel: sin ID no se carga. */}
        {settings.gtmId ? (
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})
(window,document,'script','dataLayer','${settings.gtmId}');`}
          </Script>
        ) : null}

        {settings.gaMeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${settings.gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${settings.gaMeasurementId}',{currency:'${intl ? 'USD' : 'CLP'}'});`}
            </Script>
          </>
        ) : null}

      </body>
    </html>
  );
}
