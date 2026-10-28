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
  /**
   * Momento en que se libera el ganador, en ISO (UTC). Vacío: se ve apenas se
   * publica. Antes de esa hora el ganador no sale del servidor.
   */
  revealAt: string;
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
  revealAt: '',
};

export const GIVEAWAY_KEY = 'giveaway';

export const CHILE_TZ = 'America/Santiago';

/** Minutos que America/Santiago está corrida respecto de UTC en ese instante. */
function chileOffsetMinutes(utcMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CHILE_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - utcMs) / 60_000);
}

/** "2026-10-30T20:00" en hora de Chile → ISO en UTC. Respeta el horario de verano. */
export function chileLocalToIso(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Dos pasadas: la primera estima el desfase y la segunda lo corrige si
  // justo cae en el cambio de horario.
  let utc = naive - chileOffsetMinutes(naive) * 60_000;
  utc = naive - chileOffsetMinutes(utc) * 60_000;
  return new Date(utc).toISOString();
}

/** ISO → "2026-10-30T20:00" en hora de Chile, para el campo del panel. */
export function isoToChileLocal(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms + chileOffsetMinutes(ms) * 60_000).toISOString().slice(0, 16);
}

/** "jueves 30 de octubre, 20:00" en hora de Chile. */
export function formatChileDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: CHILE_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** "mié 28 oct, 20:00" en hora de Chile, para avisos cortos. */
export function formatChileShort(iso: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: CHILE_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(iso))
    .replace(/\./g, '');
}

export function isRevealed(g: Pick<Giveaway, 'revealAt'>, now = Date.now()): boolean {
  return !g.revealAt || Date.parse(g.revealAt) <= now;
}

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
