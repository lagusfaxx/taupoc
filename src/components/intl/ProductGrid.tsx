import Image from 'next/image';
import Link from 'next/link';
import type { IntlCard } from '@/lib/intl-catalog';
import { formatUsdCents } from '@/lib/fx';

/**
 * Grilla de taupoc.lat: la foto lo más grande posible y, debajo, solo texto.
 * Sin tarjetas, bordes, sombras ni sellos.
 */
export function ProductGrid({ cards, priority = 0 }: { cards: IntlCard[]; priority?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-14 sm:grid-cols-2 sm:gap-x-6 2xl:grid-cols-3">
      {cards.map((card, i) => (
        <li key={card.key}>
          <Link href={card.href} className="group block">
            <div className="relative aspect-[4/5] overflow-hidden bg-paper">
              <Image
                src={card.image.url}
                alt={card.image.alt || `${card.productName} ${card.colorName}`}
                fill
                priority={i < priority}
                sizes="(max-width: 640px) 100vw, (max-width: 1536px) 50vw, 33vw"
                className="object-contain transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              />
            </div>
            <div className="mt-5 flex items-baseline justify-between gap-4 text-[15px]">
              <div>
                <p className="font-medium text-graphite">{card.productName}</p>
                <p className="mt-0.5 text-graphite-soft">{card.colorName}</p>
              </div>
              <p className="shrink-0 text-right text-graphite">
                {card.comingSoon ? (
                  <span className="text-graphite-soft">Próximamente</span>
                ) : !card.available ? (
                  <span className="text-graphite-soft">Agotado</span>
                ) : card.priceCents != null ? (
                  formatUsdCents(card.priceCents)
                ) : null}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
