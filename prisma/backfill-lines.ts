import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { applyLines } from './lines-data';

/**
 * Aplica las líneas y su comparador sobre una tienda ya cargada.
 *
 * A diferencia del seed, no mira si hay catálogo ni escribe productos, fotos,
 * stock, precios ni ajustes: solo la tabla de líneas y sus filas de
 * comparación. Se puede correr las veces que haga falta.
 */
const prisma = new PrismaClient();

async function main() {
  await applyLines(prisma);

  const lines = await prisma.productLine.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { name: true, tierLabel: true, _count: { select: { metrics: true } } },
  });

  for (const line of lines) {
    console.log(
      `· ${line.name}${line.tierLabel ? ` — ${line.tierLabel}` : ''}` +
        ` · ${line._count.metrics} filas de comparación`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
