export const SIZES = ['20', '22', '24', '26', '28', '30', '32', '34', '36'] as const;

export interface ColorSpec {
  name: string;
  slug: string;
  /** Código de colorway del fabricante. */
  code: string | null;
  hex: string;
  accentHex: string;
  /** Código del vivo. */
  stripCode: string | null;
  stripHex: string | null;
  active: boolean;
}

/**
 * Colorways de la línea R-SKIN.
 *
 * Los ocho primeros son los del primer pedido, con su código de colorway y de
 * vivo. Los siete restantes quedan inactivos hasta tener sus códigos: existen
 * en el sistema para que el panel pueda activarlos, pero no se muestran en la
 * tienda mientras no estén confirmados.
 */
export const RSKIN_COLORS: ColorSpec[] = [
  { name: 'Negro', slug: 'negro-9192', code: '9192', hex: '#101114', accentHex: '#00E0B8', stripCode: '1360', stripHex: null, active: true },
  { name: 'Blanco', slug: 'blanco-0015-0028', code: '0015-0028', hex: '#F1F3F5', accentHex: '#0BB7E0', stripCode: '0443', stripHex: null, active: true },
  { name: 'Azul Marino', slug: 'azul-marino-60289', code: '60289', hex: '#17285A', accentHex: '#5C7BE0', stripCode: '0524', stripHex: null, active: true },
  { name: 'Púrpura', slug: 'purpura-50008', code: '50008', hex: '#5B2A8C', accentHex: '#A46BFF', stripCode: '0524', stripHex: null, active: true },
  { name: 'Azul', slug: 'azul-60047', code: '60047', hex: '#1B62C4', accentHex: '#4B9BF0', stripCode: '0727', stripHex: null, active: true },
  { name: 'Azul', slug: 'azul-6093', code: '6093', hex: '#0E3F86', accentHex: '#3F7BD6', stripCode: '0727', stripHex: null, active: true },
  { name: 'Rojo', slug: 'rojo-4184', code: '4184', hex: '#C8102E', accentHex: '#FF4A57', stripCode: '0524', stripHex: null, active: true },
  { name: 'Rosado', slug: 'rosado-30049', code: '30049', hex: '#E8467C', accentHex: '#FF5CA3', stripCode: '0443', stripHex: null, active: true },

  { name: 'Naranja', slug: 'naranja-2150', code: '2150', hex: '#FF5A1F', accentHex: '#FF7A48', stripCode: null, stripHex: null, active: true },
  { name: 'Aqua', slug: 'aqua', code: null, hex: '#00E0B8', accentHex: '#00E0B8', stripCode: null, stripHex: null, active: false },
  { name: 'Verde Lima', slug: 'verde-lima', code: null, hex: '#B6E600', accentHex: '#C8F52C', stripCode: null, stripHex: null, active: false },
  { name: 'Amarillo', slug: 'amarillo', code: null, hex: '#FFC400', accentHex: '#FFD84D', stripCode: null, stripHex: null, active: false },
  { name: 'Turquesa', slug: 'turquesa', code: null, hex: '#0891A8', accentHex: '#2CC2DA', stripCode: null, stripHex: null, active: false },
  { name: 'Vino', slug: 'vino', code: null, hex: '#7A1030', accentHex: '#D64B72', stripCode: null, stripHex: null, active: false },
  { name: 'Plata', slug: 'plata', code: null, hex: '#C9CFD6', accentHex: '#9FB0C2', stripCode: null, stripHex: null, active: false },
];

/** VEL-SKIN se lanza en dos colorways. */
export const VELSKIN_COLORS: ColorSpec[] = [
  RSKIN_COLORS[3],
  RSKIN_COLORS[0],
];

/**
 * Inventario inicial: 24 SKU con 2 unidades cada uno.
 * Clave: talla → códigos de colorway.
 */
export const INITIAL_STOCK: Record<string, Record<string, string[]>> = {
  TS703: {
    '22': ['9192', '60289', '50008'],
    '24': ['9192', '60047', '50008'],
    '26': ['9192', '4184', '6093'],
    '28': ['9192', '60289', '2150'],
  },
  TS704: {
    '22': ['9192', '30049', '50008'],
    '24': ['9192', '0015-0028', '50008'],
    '26': ['9192', '4184', '6093', '60047'],
    '28': ['9192', '60289', '60047'],
  },
};

export const UNITS_PER_SKU = 2;

export interface SizeRow {
  size: string;
  chest?: [number, number];
  waist: [number, number];
  /** El jammer no trae cadera en la tabla oficial. */
  hip?: [number, number];
  /** Estatura de referencia: el número del talle chino (3XS/120 = 120 cm). */
  height: number;
  cn: string;
  usa: string;
  uk: string;
  aus: string;
  nz: string;
}

/** Tabla de tallas masculina (jammer), según la tabla oficial R-Skin Jammer de TAUPOC. */
export const MEN_SIZE_CHART: SizeRow[] = [
  { size: '20', waist: [50, 55], height: 120, cn: '3XS/120', usa: '20', uk: '20', aus: '6', nz: 'B4' },
  { size: '22', waist: [55, 60], height: 130, cn: '2XS/130', usa: '22', uk: '22', aus: '8', nz: 'B6' },
  { size: '24', waist: [60, 65], height: 140, cn: 'XS/140', usa: '24', uk: '24', aus: '10', nz: 'B8' },
  { size: '26', waist: [65, 70], height: 150, cn: 'S/150', usa: '26', uk: '26', aus: '12', nz: 'B10' },
  { size: '28', waist: [70, 75], height: 160, cn: 'M/160', usa: '28', uk: '28', aus: '14', nz: 'B12' },
  { size: '30', waist: [75, 80], height: 165, cn: 'L/165', usa: '30', uk: '30', aus: 'M14', nz: 'B14' },
  { size: '32', waist: [80, 85], height: 170, cn: 'XL/170', usa: '32', uk: '32', aus: 'M16', nz: 'M14' },
  { size: '34', waist: [85, 90], height: 175, cn: '2XL/175', usa: '34', uk: '34', aus: 'M18', nz: 'M16' },
  { size: '36', waist: [90, 95], height: 180, cn: '3XL/180', usa: '36', uk: '36', aus: 'M20', nz: 'M18' },
];

/** Tabla de tallas femenina (knee suit), según la tabla oficial R-Skin Knee Suit de TAUPOC. */
export const WOMEN_SIZE_CHART: SizeRow[] = [
  { size: '20', chest: [55, 60], waist: [50, 55], hip: [55, 60], height: 120, cn: '3XS/120', usa: '20', uk: '20', aus: 'G6', nz: 'G4' },
  { size: '22', chest: [60, 65], waist: [55, 60], hip: [60, 65], height: 130, cn: '2XS/130', usa: '22', uk: '22', aus: 'G8', nz: 'G6' },
  { size: '24', chest: [65, 70], waist: [60, 65], hip: [65, 70], height: 140, cn: 'XS/140', usa: '24', uk: '24', aus: 'G10', nz: 'G8' },
  { size: '26', chest: [70, 75], waist: [65, 70], hip: [70, 80], height: 150, cn: 'S/150', usa: '26', uk: '26', aus: 'G12', nz: 'G10' },
  { size: '28', chest: [75, 80], waist: [70, 75], hip: [80, 85], height: 160, cn: 'M/160', usa: '28', uk: '28', aus: 'G14', nz: 'G12' },
  { size: '30', chest: [80, 85], waist: [70, 75], hip: [85, 90], height: 165, cn: 'L/165', usa: '30', uk: '30', aus: 'S/L8', nz: 'G14' },
  { size: '32', chest: [85, 90], waist: [75, 80], hip: [90, 95], height: 170, cn: 'XL/170', usa: '32', uk: '32', aus: 'M/L10', nz: 'W8' },
  { size: '34', chest: [90, 95], waist: [80, 85], hip: [95, 100], height: 175, cn: '2XL/175', usa: '34', uk: '34', aus: 'L/L12', nz: 'W10' },
  { size: '36', chest: [95, 100], waist: [85, 90], hip: [100, 105], height: 180, cn: '3XL/180', usa: '36', uk: '36', aus: 'XL/L14', nz: 'W12' },
];
