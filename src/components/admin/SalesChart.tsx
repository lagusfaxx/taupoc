'use client';

import { useId, useMemo, useState } from 'react';
import { formatCLP } from '@/lib/money';

export interface SalesPoint {
  label: string;
  iso: string;
  total: number;
  orders: number;
}

/**
 * Gráfico de área en SVG puro. Sin librería de charting: son pocos puntos,
 * y así el panel no carga 100 kB extra de JavaScript.
 */
export function SalesChart({ points }: { points: SalesPoint[] }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const width = 720;
  const height = 220;
  const padX = 8;
  const padY = 16;

  const max = Math.max(1, ...points.map((p) => p.total));

  const coords = useMemo(
    () =>
      points.map((point, i) => {
        const x = points.length === 1
          ? width / 2
          : padX + (i * (width - padX * 2)) / (points.length - 1);
        const y = height - padY - (point.total / max) * (height - padY * 2);
        return { x, y, point };
      }),
    [points, max],
  );

  if (points.length === 0) {
    return (
      <p className="py-14 text-center text-[13px] text-chalk-faint">
        Todavía no hay ventas registradas en este período.
      </p>
    );
  }

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;
  const active = hover != null ? coords[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[220px] w-full"
        role="img"
        aria-label={`Ventas diarias. Máximo ${formatCLP(max)}.`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={0}
            x2={width}
            y1={height - padY - t * (height - padY * 2)}
            y2={height - padY - t * (height - padY * 2)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />

        {coords.map((c, i) => (
          <g key={c.point.iso}>
            <rect
              x={c.x - (width / Math.max(1, points.length)) / 2}
              y={0}
              width={width / Math.max(1, points.length)}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {hover === i ? (
              <>
                <line x1={c.x} x2={c.x} y1={0} y2={height} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
                <circle cx={c.x} cy={c.y} r={4} fill="var(--accent)" />
              </>
            ) : null}
          </g>
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[10.5px] text-chalk-faint">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>

      {active ? (
        <div
          className="pointer-events-none absolute top-2 border border-line bg-ink-800 px-3 py-2 text-[12px] shadow-lift"
          style={{
            left: `${Math.min(80, Math.max(0, (active.x / width) * 100))}%`,
            transform: 'translateX(-10%)',
          }}
        >
          <p className="font-display text-[9.5px] uppercase tracking-widest text-chalk-faint">
            {active.point.label}
          </p>
          <p className="mt-1 font-display text-[14px] font-bold accent-text">
            {formatCLP(active.point.total)}
          </p>
          <p className="text-chalk-faint">
            {active.point.orders} {active.point.orders === 1 ? 'pedido' : 'pedidos'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
