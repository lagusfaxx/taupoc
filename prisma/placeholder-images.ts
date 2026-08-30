import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

/**
 * Genera imágenes de producto provisionales con la identidad de marca.
 * Existen para que la tienda nunca se vea rota antes de cargar la
 * fotografía real; el admin las reemplaza con drag & drop.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_PREFIX = '/uploads';

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Marca TAUPOC simplificada: dos arcos cruzados. */
function mark(cx: number, cy: number, scale: number, color: string, opacity: number) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale})" fill="none" stroke="${color}" stroke-width="9" opacity="${opacity}" stroke-linecap="square">
    <path d="M -62 -70 C -46 -6 -20 34 6 66" />
    <path d="M 62 -70 C 46 -6 20 34 -6 66" />
    <path d="M -34 12 L 40 62" />
    <path d="M 34 12 L -40 62" />
  </g>`;
}

interface Variation {
  suffix: string;
  /** 0 = plano frontal, 1 = detalle macro, 2 = contraluz. */
  kind: 0 | 1 | 2;
}

const VARIATIONS: Variation[] = [
  { suffix: 'frontal', kind: 0 },
  { suffix: 'detalle', kind: 1 },
  { suffix: 'espalda', kind: 2 },
];

function svgFor(opts: {
  width: number;
  height: number;
  hex: string;
  label: string;
  sublabel: string;
  kind: 0 | 1 | 2;
}) {
  const { width: w, height: h, hex, kind } = opts;
  const dark = '#0B0E11';

  const backdrop =
    kind === 1
      ? `<radialGradient id="bg" cx="38%" cy="34%" r="82%">
           <stop offset="0%" stop-color="${hex}" stop-opacity="0.34"/>
           <stop offset="55%" stop-color="#12161B"/>
           <stop offset="100%" stop-color="${dark}"/>
         </radialGradient>`
      : kind === 2
        ? `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
             <stop offset="0%" stop-color="#161B21"/>
             <stop offset="62%" stop-color="#0D1115"/>
             <stop offset="100%" stop-color="${dark}"/>
           </linearGradient>`
        : `<radialGradient id="bg" cx="50%" cy="30%" r="78%">
             <stop offset="0%" stop-color="#1B2128"/>
             <stop offset="70%" stop-color="#0E1216"/>
             <stop offset="100%" stop-color="${dark}"/>
           </radialGradient>`;

  // Silueta abstracta del traje: una banda vertical con el corte diagonal
  // característico de la línea, teñida con el color de la variante.
  const suitX = w * 0.5;
  const suitW = w * (kind === 1 ? 0.62 : 0.34);
  const suitH = h * (kind === 1 ? 0.5 : 0.72);
  const suitY = h * (kind === 1 ? 0.26 : 0.14);

  const suit = `
    <g>
      <rect x="${suitX - suitW / 2}" y="${suitY}" width="${suitW}" height="${suitH}" rx="${suitW * 0.16}"
            fill="url(#suit)" />
      <path d="M ${suitX - suitW / 2} ${suitY + suitH * 0.62}
               C ${suitX - suitW * 0.1} ${suitY + suitH * 0.44},
                 ${suitX + suitW * 0.12} ${suitY + suitH * 0.34},
                 ${suitX + suitW / 2} ${suitY + suitH * 0.08}"
            stroke="rgba(255,255,255,0.5)" stroke-width="${Math.max(2, w * 0.004)}" fill="none"/>
      <path d="M ${suitX - suitW / 2} ${suitY + suitH * 0.78}
               C ${suitX - suitW * 0.06} ${suitY + suitH * 0.6},
                 ${suitX + suitW * 0.16} ${suitY + suitH * 0.5},
                 ${suitX + suitW / 2} ${suitY + suitH * 0.24}"
            stroke="rgba(0,0,0,0.35)" stroke-width="${Math.max(2, w * 0.005)}" fill="none"/>
      <rect x="${suitX - suitW / 2}" y="${suitY}" width="${suitW}" height="${suitH}" rx="${suitW * 0.16}"
            fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="${Math.max(1.5, w * 0.0022)}"/>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      ${backdrop}
      <linearGradient id="suit" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stop-color="${hex}" stop-opacity="0.95"/>
        <stop offset="48%" stop-color="${hex}" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="${hex}" stop-opacity="0.42"/>
      </linearGradient>
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#grid)"/>
    ${suit}
    ${mark(w * 0.5, h * 0.5, w / 620, '#FFFFFF', 0.07)}
    <text x="${w * 0.5}" y="${h - h * 0.085}" text-anchor="middle"
          font-family="Arial,Helvetica,sans-serif" font-size="${Math.round(w * 0.032)}"
          font-weight="700" letter-spacing="${w * 0.012}" fill="rgba(255,255,255,0.82)">TAUPOC</text>
    <text x="${w * 0.5}" y="${h - h * 0.04}" text-anchor="middle"
          font-family="Arial,Helvetica,sans-serif" font-size="${Math.round(w * 0.019)}"
          letter-spacing="${w * 0.006}" fill="rgba(255,255,255,0.4)">${escapeXml(opts.sublabel.toUpperCase())}</text>
  </svg>`;
}

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export async function generateProductImages(params: {
  productSlug: string;
  productName: string;
  colorSlug: string;
  colorName: string;
  hex: string;
}): Promise<GeneratedImage[]> {
  const folder = path.join(UPLOAD_DIR, 'catalogo', params.productSlug);
  await mkdir(folder, { recursive: true });

  const out: GeneratedImage[] = [];
  for (const variation of VARIATIONS) {
    const width = 1200;
    const height = 1500;
    const svg = svgFor({
      width,
      height,
      hex: params.hex,
      label: params.productName,
      sublabel: `${params.colorName} · ${variation.suffix}`,
      kind: variation.kind,
    });
    const filename = `${params.colorSlug}-${variation.suffix}.webp`;
    const buffer = await sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
    await writeFile(path.join(folder, filename), buffer);
    out.push({
      url: `${PUBLIC_PREFIX}/catalogo/${params.productSlug}/${filename}`,
      width,
      height,
      alt: `${params.productName} color ${params.colorName} — vista ${variation.suffix}`,
    });
  }
  return out;
}

/** Imagen ancha para el hero y las portadas del blog. */
export async function generateWideImage(params: {
  name: string;
  hex: string;
  caption: string;
  width?: number;
  height?: number;
  folder?: string;
}): Promise<GeneratedImage> {
  const width = params.width ?? 2000;
  const height = params.height ?? 1200;
  const folder = path.join(UPLOAD_DIR, params.folder ?? 'editorial');
  await mkdir(folder, { recursive: true });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0A0D10"/>
        <stop offset="45%" stop-color="#12181F"/>
        <stop offset="100%" stop-color="#070909"/>
      </linearGradient>
      <radialGradient id="glow" cx="72%" cy="38%" r="55%">
        <stop offset="0%" stop-color="${params.hex}" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="${params.hex}" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect width="${width}" height="${height}" fill="url(#grid)"/>
    <rect width="${width}" height="${height}" fill="url(#glow)"/>
    <g opacity="0.55">
      <path d="M ${width * 0.58} ${height} C ${width * 0.66} ${height * 0.6}, ${width * 0.78} ${height * 0.38}, ${width * 0.9} 0"
            stroke="${params.hex}" stroke-opacity="0.5" stroke-width="3" fill="none"/>
      <path d="M ${width * 0.48} ${height} C ${width * 0.58} ${height * 0.62}, ${width * 0.7} ${height * 0.36}, ${width * 0.8} 0"
            stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2" fill="none"/>
      <path d="M ${width * 0.68} ${height} C ${width * 0.74} ${height * 0.58}, ${width * 0.86} ${height * 0.4}, ${width} ${height * 0.06}"
            stroke="${params.hex}" stroke-opacity="0.22" stroke-width="2" fill="none"/>
    </g>
    ${mark(width * 0.74, height * 0.46, width / 820, params.hex, 0.14)}
  </svg>`;

  const slug = params.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${slug}.webp`;
  const buffer = await sharp(Buffer.from(svg)).webp({ quality: 86 }).toBuffer();
  await writeFile(path.join(folder, filename), buffer);

  return {
    url: `${PUBLIC_PREFIX}/${params.folder ?? 'editorial'}/${filename}`,
    width,
    height,
    alt: params.name,
  };
}
