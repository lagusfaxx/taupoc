/**
 * Sorteos de Instagram: el ganador ya se eligió afuera; acá se publica la
 * lista de participantes y una animación que termina siempre en él.
 *
 * Se guarda en la tabla Setting, como la configuración del sitio. Este
 * módulo no es `server-only`: el panel usa `parseEntries` para mostrar la
 * cuenta de participantes mientras se pega la lista.
 */

export interface Giveaway {
  active: boolean;
  /** Muestra el aviso "Ver ganador" arriba de todo el sitio. */
  showBanner: boolean;
  title: string;
  prize: string;
  description: string;
  /** Lista tal como se pega: una línea por comentario, "@usuario: comentario". */
  entriesText: string;
  /** Usuario ganador, con o sin @. */
  winner: string;
}

export interface GiveawayEntry {
  user: string;
  comment: string;
}

export const DEFAULT_GIVEAWAY: Giveaway = {
  active: false,
  showBanner: true,
  title: 'Sorteo TAUPOC',
  prize: '',
  description: '',
  entriesText: '',
  winner: '',
};

export const GIVEAWAY_KEY = 'giveaway';

export function normalizeUser(user: string): string {
  return user.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Lee la lista pegada. Acepta "@usuario: comentario", "@usuario comentario",
 * "usuario - comentario" o solo el usuario. Las líneas vacías se ignoran.
 */
export function parseEntries(text: string): GiveawayEntry[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^@?([\w.]+)\s*[:\-–—]?\s*(.*)$/u);
      if (!match) return { user: line.replace(/^@+/, ''), comment: '' };
      return { user: match[1], comment: match[2].trim() };
    });
}

/** Usuarios distintos, en el orden en que aparecen. */
export function uniqueUsers(entries: GiveawayEntry[]): string[] {
  const seen = new Set<string>();
  const users: string[] = [];
  for (const e of entries) {
    const key = normalizeUser(e.user);
    if (seen.has(key)) continue;
    seen.add(key);
    users.push(e.user);
  }
  return users;
}
