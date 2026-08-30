import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

/**
 * Convierte el markdown del blog a HTML.
 * El contenido lo escribe el equipo desde el panel, no usuarios anónimos.
 */
export function renderMarkdown(source: string): string {
  return marked.parse(source ?? '', { async: false }) as string;
}

/** Estimación de lectura para mostrar en la portada del blog. */
export function readingMinutes(source: string): number {
  const words = (source ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
