import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { headers } from 'next/headers';
import { getSettings } from '@/lib/settings';
import { metaPixelBootstrap } from '@/lib/meta-pixel';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  themeColor: '#07090B',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Leer la solicitud antes de los ajustes impide fijar el ID al compilar.
  const pathname = (await headers()).get('x-pathname') ?? '';
  const settings = await getSettings();
  const pixelId = settings.metaPixelId.trim();
  const pixelScript = pathname === '/admin' || pathname.startsWith('/admin/')
    ? null
    : metaPixelBootstrap(pixelId);

  return (
    <html lang="es-CL" className="dark">
      <head>
        {pixelScript ? <script id="meta-pixel" dangerouslySetInnerHTML={{ __html: pixelScript }} /> : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Hoja de estilos de fuentes cargada por enlace y no con next/font:
            así la compilación de la imagen Docker no depende de la red, y la
            pila de respaldo del sistema cubre el caso de fuentes bloqueadas. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Saira:wght@500;600;700;800;900&family=Barlow:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
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
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:accent-bg focus:px-4 focus:py-2 focus:font-display focus:text-xs focus:uppercase focus:tracking-widest"
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
gtag('js',new Date());gtag('config','${settings.gaMeasurementId}',{currency:'CLP'});`}
            </Script>
          </>
        ) : null}

      </body>
    </html>
  );
}
