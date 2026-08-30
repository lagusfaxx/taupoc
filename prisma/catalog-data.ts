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

  { name: 'Aqua', slug: 'aqua', code: null, hex: '#00E0B8', accentHex: '#00E0B8', stripCode: null, stripHex: null, active: false },
  { name: 'Verde Lima', slug: 'verde-lima', code: null, hex: '#B6E600', accentHex: '#C8F52C', stripCode: null, stripHex: null, active: false },
  { name: 'Naranja', slug: 'naranja', code: null, hex: '#FF5A1F', accentHex: '#FF7A48', stripCode: null, stripHex: null, active: false },
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
    '28': ['9192', '60289', '6093'],
  },
  TS704: {
    '22': ['9192', '30049', '50008'],
    '24': ['9192', '0015-0028', '50008'],
    '26': ['9192', '4184', '6093'],
    '28': ['9192', '60289', '60047'],
  },
};

export const UNITS_PER_SKU = 2;

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
