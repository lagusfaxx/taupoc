import 'server-only';
import { cache } from 'react';
import { prisma } from './db';

export interface NavChild {
  label: string;
  href: string;
  note?: string;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
}

/**
 * El menú por defecto, cuando el panel no tiene ninguno guardado.
 *
 * Se arma con las líneas del catálogo, así que una instalación nueva ya trae
 * la navegación completa sin que nadie la escriba. También es lo que se
 * precarga en el editor del panel: quien entra a /admin/menu ve el menú que
 * está viendo la tienda, no un formulario en blanco.
 */
export async function defaultNav(): Promise<NavItem[]> {
  const lines = await prisma.productLine.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, name: true, tagline: true },
  });

  return [
    {
      label: 'Competición',
      href: '/catalogo',
      children: [
        { label: 'Hombre — Jammers', href: '/catalogo?genero=MALE', note: 'Homologados World Aquatics' },
        { label: 'Mujer — Knee suits', href: '/catalogo?genero=FEMALE', note: 'Homologados World Aquatics' },
        ...lines
          .filter((l) => l.slug !== 'accesorios')
          .map((l) => ({
            label: `Línea ${l.name}`,
            href: `/catalogo?linea=${l.slug}`,
            note: l.tagline ?? undefined,
          })),
        { label: 'R-SKIN o VEL-SKIN', href: '/lineas', note: 'Las dos líneas comparadas dato a dato' },
        { label: 'Ver todo el catálogo', href: '/catalogo' },
      ],
    },
    { label: 'Guía de tallas', href: '/guia-de-tallas' },
    { label: 'Clubes', href: '/clubes' },
    { label: 'La marca', href: '/marca' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contacto', href: '/contacto' },
  ];
}

/**
 * El menú de la tienda: el guardado en el panel, o el de por defecto.
 *
 * Memorizado por solicitud porque el encabezado y el menú del teléfono se
 * renderizan en el mismo árbol.
 */
export const getNav = cache(async function getNav(): Promise<NavItem[]> {
  const items = await prisma.menuItem.findMany({
    where: { parentId: null, active: true },
    orderBy: { position: 'asc' },
    include: {
      children: { where: { active: true }, orderBy: { position: 'asc' } },
    },
  });

  // Sin menú guardado manda el de por defecto. Es también la salida de
  // emergencia: borrar todas las filas devuelve la navegación original.
  if (items.length === 0) return defaultNav();

  return items.map((item) => ({
    label: item.label,
    href: item.href,
    children: item.children.length
      ? item.children.map((child) => ({
          label: child.label,
          href: child.href,
          note: child.note ?? undefined,
        }))
      : undefined,
  }));
});
