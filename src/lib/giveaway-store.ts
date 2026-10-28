import 'server-only';
import { prisma } from './db';
import { DEFAULT_GIVEAWAY, GIVEAWAY_KEY, type Giveaway } from './giveaway';

export async function getGiveaway(): Promise<Giveaway> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: GIVEAWAY_KEY } });
    return { ...DEFAULT_GIVEAWAY, ...((row?.value ?? {}) as Partial<Giveaway>) };
  } catch {
    // Sin base (por ejemplo al compilar) no hay sorteo que mostrar.
    return DEFAULT_GIVEAWAY;
  }
}

export async function saveGiveaway(data: Giveaway): Promise<void> {
  await prisma.setting.upsert({
    where: { key: GIVEAWAY_KEY },
    create: { key: GIVEAWAY_KEY, value: data as object },
    update: { value: data as object },
  });
}
