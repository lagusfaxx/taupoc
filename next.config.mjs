/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    // Las imágenes de producto viajan por Server Action y pueden pesar hasta
    // 20 MB cada una; el margen cubre varias en la misma tanda.
    serverActions: { bodySizeLimit: '48mb' },
  },
  webpack(config, { isServer, dev }) {
    // Los archivos de cada página llevaban la ruta en el nombre
    // (chunks/app/(store)/producto/[slug]/page-….js). Cuando un proxy entrega
    // esa dirección con los paréntesis codificados (%28store%29) junto a los
    // corchetes, Next responde 404 y la ficha cae en "No pudimos cargar esta
    // página". Con nombres por hash no hay paréntesis ni corchetes que codificar.
    if (!isServer && !dev) {
      config.output.filename = 'static/chunks/[contenthash].js';
      config.output.chunkFilename = 'static/chunks/[contenthash].js';
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};
export default nextConfig;
