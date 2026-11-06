import 'server-only';
import { prisma } from './db';
import { DEFAULT_ROULETTE, ROULETTE_KEY, type RouletteConfig } from './roulette';

export async function getRoulette(): Promise<RouletteConfig> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: ROULETTE_KEY } });
    return { ...DEFAULT_ROULETTE, ...((row?.value ?? {}) as Partial<RouletteConfig>) };
  } catch {
    // Sin base (al compilar) la ruleta no se muestra.
    return DEFAULT_ROULETTE;
  }
}

export async function saveRoulette(config: RouletteConfig): Promise<void> {
  await prisma.setting.upsert({
    where: { key: ROULETTE_KEY },
    create: { key: ROULETTE_KEY, value: config as object },
    update: { value: config as object },
  });
}
