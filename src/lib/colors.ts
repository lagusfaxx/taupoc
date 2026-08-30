export interface ColorIdentity {
  name: string;
  code?: string | null;
}

/**
 * El catálogo tiene dos colorways llamados "Azul" (60047 y 6093), así que el
 * código del fabricante forma parte de la identidad visible del color.
 */
export function colorLabel(color: ColorIdentity): string {
  return color.code ? `${color.name} · ${color.code}` : color.name;
}
