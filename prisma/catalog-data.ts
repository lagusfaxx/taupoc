/** Datos del catálogo inicial de TAUPOC Chile. */

export const SIZES = ['20', '22', '24', '26', '28', '30', '32', '34', '36'] as const;

export interface ColorSpec {
  name: string;
  slug: string;
  hex: string;
  hexSecondary?: string;
  accentHex: string;
}

/** Los ~15 colores de la línea R-SKIN. */
export const RSKIN_COLORS: ColorSpec[] = [
  { name: 'Negro Competición', slug: 'negro', hex: '#0B0B0D', accentHex: '#00E0B8' },
  { name: 'Blanco Ártico', slug: 'blanco', hex: '#F2F3F5', accentHex: '#0BB7E0' },
  { name: 'Aqua TAUPOC', slug: 'aqua', hex: '#00E0B8', accentHex: '#00E0B8' },
  { name: 'Púrpura Racing', slug: 'purpura', hex: '#6C2BD9', accentHex: '#A46BFF' },
  { name: 'Azul Cobalto', slug: 'cobalto', hex: '#1B4FD8', accentHex: '#4B8BFF' },
  { name: 'Rojo Carrera', slug: 'rojo', hex: '#D81E2E', accentHex: '#FF4A57' },
  { name: 'Verde Lima', slug: 'lima', hex: '#B6E600', accentHex: '#C8F52C' },
  { name: 'Naranja Flúor', slug: 'naranja', hex: '#FF5A1F', accentHex: '#FF7A48' },
  { name: 'Rosa Neón', slug: 'rosa', hex: '#FF2E88', accentHex: '#FF5CA3' },
  { name: 'Amarillo Solar', slug: 'amarillo', hex: '#FFC400', accentHex: '#FFD84D' },
  { name: 'Azul Marino', slug: 'marino', hex: '#16224A', accentHex: '#5C7BE0' },
  { name: 'Gris Grafito', slug: 'grafito', hex: '#4A5158', accentHex: '#8D98A5' },
  { name: 'Turquesa Profundo', slug: 'turquesa', hex: '#0891A8', accentHex: '#2CC2DA' },
  { name: 'Vino Tinto', slug: 'vino', hex: '#7A1030', accentHex: '#D64B72' },
  { name: 'Plata Cromo', slug: 'plata', hex: '#C9CFD6', accentHex: '#9FB0C2' },
];

/** VEL-SKIN se lanza solo en dos colores. */
export const VELSKIN_COLORS: ColorSpec[] = [
  { name: 'Púrpura Racing', slug: 'purpura', hex: '#6C2BD9', accentHex: '#A46BFF' },
  { name: 'Negro Competición', slug: 'negro', hex: '#0B0B0D', accentHex: '#00E0B8' },
];

export interface SizeRow {
  size: string;
  chest?: [number, number];
  waist: [number, number];
  hip: [number, number];
  height: [number, number];
  cn: string;
  usa: string;
  uk: string;
  aus: string;
  nz: string;
}

/** Tabla de tallas masculina (jammer). Medidas del cuerpo, sin compresión. */
export const MEN_SIZE_CHART: SizeRow[] = [
  { size: '20', waist: [58, 63], hip: [68, 73], height: [140, 150], cn: '20', usa: '20', uk: '24', aus: '4', nz: '4' },
  { size: '22', waist: [62, 67], hip: [72, 77], height: [148, 158], cn: '22', usa: '22', uk: '26', aus: '6', nz: '6' },
  { size: '24', waist: [66, 71], hip: [76, 81], height: [155, 165], cn: '24', usa: '24', uk: '28', aus: '8', nz: '8' },
  { size: '26', waist: [70, 75], hip: [80, 85], height: [162, 172], cn: '26', usa: '26', uk: '30', aus: '10', nz: '10' },
  { size: '28', waist: [74, 79], hip: [84, 89], height: [168, 178], cn: '28', usa: '28', uk: '32', aus: '12', nz: '12' },
  { size: '30', waist: [78, 83], hip: [88, 93], height: [173, 183], cn: '30', usa: '30', uk: '34', aus: '14', nz: '14' },
  { size: '32', waist: [82, 87], hip: [92, 97], height: [178, 188], cn: '32', usa: '32', uk: '36', aus: '16', nz: '16' },
  { size: '34', waist: [86, 91], hip: [96, 101], height: [182, 192], cn: '34', usa: '34', uk: '38', aus: '18', nz: '18' },
  { size: '36', waist: [90, 95], hip: [100, 105], height: [185, 195], cn: '36', usa: '36', uk: '40', aus: '20', nz: '20' },
];

/** Tabla de tallas femenina (knee suit). */
export const WOMEN_SIZE_CHART: SizeRow[] = [
  { size: '20', chest: [68, 73], waist: [55, 60], hip: [72, 77], height: [140, 150], cn: '20', usa: '20', uk: '24', aus: '4', nz: '4' },
  { size: '22', chest: [72, 77], waist: [59, 64], hip: [76, 81], height: [148, 158], cn: '22', usa: '22', uk: '26', aus: '6', nz: '6' },
  { size: '24', chest: [76, 81], waist: [63, 68], hip: [80, 85], height: [155, 165], cn: '24', usa: '24', uk: '28', aus: '8', nz: '8' },
  { size: '26', chest: [80, 85], waist: [67, 72], hip: [84, 89], height: [160, 170], cn: '26', usa: '26', uk: '30', aus: '10', nz: '10' },
  { size: '28', chest: [84, 89], waist: [71, 76], hip: [88, 93], height: [165, 175], cn: '28', usa: '28', uk: '32', aus: '12', nz: '12' },
  { size: '30', chest: [88, 93], waist: [75, 80], hip: [92, 97], height: [168, 178], cn: '30', usa: '30', uk: '34', aus: '14', nz: '14' },
  { size: '32', chest: [92, 97], waist: [79, 84], hip: [96, 101], height: [172, 182], cn: '32', usa: '32', uk: '36', aus: '16', nz: '16' },
  { size: '34', chest: [96, 101], waist: [83, 88], hip: [100, 105], height: [175, 185], cn: '34', usa: '34', uk: '38', aus: '18', nz: '18' },
  { size: '36', chest: [100, 105], waist: [87, 92], hip: [104, 109], height: [178, 188], cn: '36', usa: '36', uk: '40', aus: '20', nz: '20' },
];
