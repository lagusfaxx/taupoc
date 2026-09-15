import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { defaultNav } from '@/lib/nav';
import { PageHeader } from '@/components/admin/PageHeader';
import { MenuManager, type MenuRow } from '@/components/admin/MenuManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({ title: 'Panel — Menú', noIndex: true });

export default async function AdminMenuPage() {
  await requireAdmin();

  const [guardado, lines, categories] = await Promise.all([
    prisma.menuItem.findMany({
      where: { parentId: null },
      orderBy: { position: 'asc' },
      include: { children: { orderBy: { position: 'asc' } } },
    }),
    prisma.productLine.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    }),
  ]);

  // Con el menú sin guardar se precarga el de por defecto: quien entra edita
  // el menú que está viendo la tienda, no un formulario en blanco.
  const rows: MenuRow[] = guardado.length
    ? guardado.map((item) => ({
        label: item.label,
        href: item.href,
        note: item.note ?? '',
        active: item.active,
        children: item.children.map((child) => ({
          label: child.label,
          href: child.href,
          note: child.note ?? '',
          active: child.active,
        })),
      }))
    : (await defaultNav()).map((item) => ({
        label: item.label,
        href: item.href,
        note: '',
        active: true,
        children: (item.children ?? []).map((child) => ({
          label: child.label,
          href: child.href,
          note: child.note ?? '',
          active: true,
        })),
      }));

  const suggestions = [
    { label: 'Catálogo completo', href: '/catalogo' },
    { label: 'Competición hombre', href: '/catalogo?genero=MALE' },
    { label: 'Competición mujer', href: '/catalogo?genero=FEMALE' },
    ...lines.map((l) => ({ label: `Línea ${l.name}`, href: `/catalogo?linea=${l.slug}` })),
    ...categories.map((c) => ({ label: c.name, href: `/catalogo?categoria=${c.slug}` })),
    { label: 'Comparación de líneas', href: '/lineas' },
    { label: 'Guía de tallas', href: '/guia-de-tallas' },
    { label: 'Clubes', href: '/clubes' },
    { label: 'La marca', href: '/marca' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contacto', href: '/contacto' },
    { label: 'Envíos', href: '/envios' },
    { label: 'Devoluciones', href: '/devoluciones' },
  ];

  return (
    <>
      <PageHeader
        title="Menú de la tienda"
        description="Los enlaces del encabezado y sus desplegables. El orden de las filas es el orden en pantalla. Si borras todas y guardas, la tienda vuelve al menú por defecto."
      />
      <MenuManager items={rows} suggestions={suggestions} guardado={guardado.length > 0} />
    </>
  );
}
