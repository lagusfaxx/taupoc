import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconArrow } from '@/components/ui/Icons';

export function SectionHeading({
  eyebrow,
  title,
  description,
  link,
  align = 'left',
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  link?: { href: string; label: string };
  align?: 'left' | 'center';
}) {
  return (
    <div
      className={
        align === 'center'
          ? 'mx-auto max-w-2xl text-center'
          : 'flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between'
      }
    >
      <div className={align === 'center' ? '' : 'max-w-2xl'}>
        {eyebrow ? <p className="eyebrow-accent mb-3">{eyebrow}</p> : null}
        <h2 className="text-balance font-display text-[28px] leading-[1.05] tracking-tightest text-chalk sm:text-[38px] lg:text-[44px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-4 text-pretty text-[15px] leading-relaxed text-chalk-dim">{description}</p>
        ) : null}
      </div>

      {link ? (
        <Link
          href={link.href}
          className="group inline-flex shrink-0 items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim transition-colors hover:accent-text"
        >
          {link.label}
          <IconArrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      ) : null}
    </div>
  );
}
