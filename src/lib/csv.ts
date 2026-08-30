/**
 * Serialización CSV compatible con Excel en español.
 *
 * Excel en configuración regional chilena espera punto y coma como separador,
 * y necesita el BOM UTF-8 para mostrar bien tildes y ñ.
 */

const SEPARATOR = ';';

function escapeCell(value: unknown): string {
  if (value == null) return '';
  let text = String(value);
  // Evita que Excel interprete un valor como fórmula.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (text.includes(SEPARATOR) || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCell).join(SEPARATOR),
    ...rows.map((row) => row.map(escapeCell).join(SEPARATOR)),
  ];
  return `﻿${lines.join('\r\n')}`;
}

export function csvResponse(filename: string, csv: string): Response {
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Fecha en formato local, listo para pegar en una planilla. */
export function csvDate(date: Date | null | undefined): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}
