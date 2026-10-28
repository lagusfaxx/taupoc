'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GiveawayEntry } from '@/lib/giveaway';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'drawing' | 'done';

const CONFETTI_COLORS = ['var(--accent)', '#ffffff', '#ffd23f', '#ff5d8f', '#3ec1ff'];
const PAGE = 120;

function Avatar({ user, className }: { user: string; className?: string }) {
  // Color estable por usuario, para que la lista no se vea plana.
  const hue = [...user].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full font-display font-bold uppercase text-ink', className)}
      style={{ background: `hsl(${hue} 70% 65%)` }}
    >
      {user.charAt(0)}
    </span>
  );
}

function CommentWall({ entries, fast }: { entries: GiveawayEntry[]; fast: boolean }) {
  // Tres filas que corren en sentidos alternos con los comentarios de fondo.
  const rows = useMemo(() => {
    const sample = entries.slice(0, 90);
    return [0, 1, 2].map((r) => sample.filter((_, i) => i % 3 === r));
  }, [entries]);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-4 overflow-hidden"
      // Tenue y desvanecido al centro, para que el título se lea encima.
      style={{
        opacity: 0.1,
        maskImage: 'radial-gradient(ellipse at center, transparent 20%, black 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 20%, black 75%)',
      }}
    >
      {rows.map((row, r) =>
        row.length === 0 ? null : (
          <div
            key={r}
            className="flex w-max gap-3"
            style={{
              animationName: 'sorteo-marquee',
              animationDuration: `${fast ? 8 : 40 + r * 8}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              animationDirection: r % 2 ? 'reverse' : 'normal',
            }}
          >
            {[...row, ...row].map((e, i) => (
              <span key={i} className="whitespace-nowrap border border-line-bright px-3 py-1.5 text-[13px] text-chalk">
                <b>@{e.user}</b> {e.comment}
              </span>
            ))}
          </div>
        ),
      )}
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.4 + Math.random() * 2,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        drift: (Math.random() - 0.5) * 240,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-20px] block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            background: p.color,
            animation: `sorteo-confetti ${p.duration}s cubic-bezier(.2,.6,.4,1) ${p.delay}s forwards`,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}

export function GiveawayDraw({
  title,
  prize,
  description,
  entries,
  winner,
  participants,
}: {
  title: string;
  prize: string;
  description: string;
  entries: GiveawayEntry[];
  winner: GiveawayEntry;
  participants: number;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [current, setCurrent] = useState<GiveawayEntry | null>(null);
  const [ticks, setTicks] = useState(0);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const draw = () => {
    if (timer.current) clearTimeout(timer.current);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduced ? 6 : 46;
    const others = entries.filter((e) => e.user.toLowerCase() !== winner.user.toLowerCase());
    const pool = others.length > 0 ? others : entries;
    setPhase('drawing');
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    let step = 0;
    const next = () => {
      step += 1;
      setTicks(step);
      if (step >= steps) {
        setCurrent(winner);
        setPhase('done');
        return;
      }
      setCurrent(pool[Math.floor(Math.random() * pool.length)]);
      // Arranca rápido y frena al final, como una ruleta.
      const t = step / steps;
      const delay = reduced ? 220 : 45 + Math.pow(t, 3) * 650;
      timer.current = setTimeout(next, delay);
    };
    next();
  };

  const filtered = useMemo(() => {
    const q = query.trim().replace(/^@/, '').toLowerCase();
    return q
      ? entries.filter((e) => e.user.toLowerCase().includes(q) || e.comment.toLowerCase().includes(q))
      : entries;
  }, [entries, query]);

  const progress = phase === 'drawing' ? Math.min(100, (ticks / 46) * 100) : phase === 'done' ? 100 : 0;

  return (
    <>
      <style>{`
        @keyframes sorteo-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes sorteo-confetti {
          0% { transform: translate3d(0,0,0) rotate(0); opacity: 1 }
          100% { transform: translate3d(var(--drift), 110vh, 0) rotate(var(--spin)); opacity: .9 }
        }
        @keyframes sorteo-pop { 0% { transform: scale(.6); opacity: 0 } 60% { transform: scale(1.06); opacity: 1 } 100% { transform: scale(1) } }
        @keyframes sorteo-glow { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent) } 50% { box-shadow: 0 0 60px 6px color-mix(in srgb, var(--accent) 45%, transparent) } }
        @media (prefers-reduced-motion: reduce) { [style*="sorteo-marquee"] { animation-name: none !important } }
      `}</style>

      {phase === 'done' ? <Confetti key={ticks} /> : null}

      <section className="relative overflow-hidden border-b border-line bg-ink-900">
        <CommentWall entries={entries} fast={phase === 'drawing'} />
        <div className="relative container flex flex-col items-center py-14 text-center lg:py-20">
          <p className="eyebrow-accent mb-3">Sorteo en Instagram</p>
          <h1 className="max-w-3xl text-balance font-display text-[34px] leading-[1] tracking-tightest text-chalk sm:text-[52px]">
            {title}
          </h1>
          {prize ? (
            <p className="mt-4 text-[17px] text-chalk-dim">
              Premio: <span className="font-semibold text-chalk">{prize}</span>
            </p>
          ) : null}
          {description ? (
            <p className="mt-4 max-w-2xl text-pretty text-[15px] leading-relaxed text-chalk-dim">{description}</p>
          ) : null}

          <div className="mt-8 flex gap-8 font-display">
            <div>
              <p className="text-[32px] font-bold leading-none accent-text">{entries.length.toLocaleString('es-CL')}</p>
              <p className="mt-1.5 text-[10.5px] uppercase tracking-widest text-chalk-faint">Comentarios</p>
            </div>
            <div>
              <p className="text-[32px] font-bold leading-none text-chalk">{participants.toLocaleString('es-CL')}</p>
              <p className="mt-1.5 text-[10.5px] uppercase tracking-widest text-chalk-faint">Participantes</p>
            </div>
          </div>

          {/* La ruleta */}
          <div ref={resultRef} className="mt-10 w-full max-w-xl scroll-mt-24">
            {phase === 'idle' ? (
              <button
                type="button"
                onClick={draw}
                className="h-16 w-full accent-bg font-display text-[15px] font-bold uppercase tracking-widest transition clip-notch-sm hover:brightness-110 sm:text-[17px]"
                style={{ animation: 'sorteo-glow 2.4s ease-in-out infinite' }}
              >
                Ver ganador
              </button>
            ) : (
              <div
                className={cn(
                  'relative border bg-ink px-5 py-7 transition-colors sm:px-8',
                  phase === 'done' ? 'accent-border' : 'border-line-bright',
                )}
                style={phase === 'done' ? { animation: 'sorteo-glow 2.4s ease-in-out infinite' } : undefined}
                aria-live="polite"
              >
                <p className="font-display text-[11px] uppercase tracking-widest text-chalk-faint">
                  {phase === 'done' ? '¡Tenemos ganador!' : `Mezclando ${entries.length.toLocaleString('es-CL')} comentarios…`}
                </p>
                {current ? (
                  <div
                    key={phase === 'done' ? 'winner' : ticks}
                    className="mt-4 flex flex-col items-center gap-3"
                    style={phase === 'done' ? { animation: 'sorteo-pop .7s cubic-bezier(.2,.9,.3,1.2) both' } : undefined}
                  >
                    <Avatar user={current.user} className={phase === 'done' ? 'h-20 w-20 text-[32px]' : 'h-14 w-14 text-[22px]'} />
                    <p
                      className={cn(
                        'break-all font-display font-bold tracking-tight',
                        phase === 'done' ? 'text-[34px] accent-text sm:text-[44px]' : 'text-[24px] text-chalk',
                      )}
                    >
                      @{current.user}
                    </p>
                    {current.comment ? (
                      <p className="line-clamp-3 max-w-md text-[14.5px] leading-relaxed text-chalk-dim">“{current.comment}”</p>
                    ) : null}
                  </div>
                ) : null}

                {phase === 'drawing' ? (
                  <div className="mt-6 h-1 w-full bg-line">
                    <div className="h-full accent-bg transition-[width] duration-200" style={{ width: `${progress}%` }} />
                  </div>
                ) : null}

                {phase === 'done' ? (
                  <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <a
                      href={`https://www.instagram.com/${encodeURIComponent(winner.user)}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-11 accent-bg px-6 font-display text-[11px] font-bold uppercase leading-[44px] tracking-widest transition hover:brightness-110"
                    >
                      Ver perfil en Instagram
                    </a>
                    <button
                      type="button"
                      onClick={draw}
                      className="h-11 border border-line-bright px-6 font-display text-[11px] font-bold uppercase tracking-widest text-chalk transition hover:border-chalk"
                    >
                      Ver de nuevo
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Todos los comentarios */}
      <section className="container py-12 lg:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-[24px] leading-tight tracking-tightest text-chalk sm:text-[30px]">
              Todos los participantes
            </h2>
            <p className="mt-1.5 text-[14px] text-chalk-faint">Busca tu usuario para ver tu comentario.</p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="@tu_usuario"
            className="w-full border border-line bg-ink-900 px-3.5 py-3 text-base text-chalk placeholder:text-chalk-faint/60 focus:border-[var(--accent)] focus:outline-none sm:w-72 sm:text-[15px]"
          />
        </div>

        <p className="mt-4 text-[13px] text-chalk-faint">
          {filtered.length.toLocaleString('es-CL')} {filtered.length === 1 ? 'comentario' : 'comentarios'}
        </p>

        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, limit).map((e, i) => {
            const isWinner = phase === 'done' && e.user.toLowerCase() === winner.user.toLowerCase();
            return (
              <li
                key={`${e.user}-${i}`}
                className={cn(
                  'flex items-start gap-3 border px-3.5 py-3',
                  isWinner ? 'accent-border bg-ink-800' : 'border-line bg-ink-900',
                )}
              >
                <Avatar user={e.user} className="h-9 w-9 text-[14px]" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-chalk">
                    @{e.user}
                    {isWinner ? <span className="ml-2 font-display text-[10px] uppercase tracking-widest accent-text">Ganador</span> : null}
                  </span>
                  {e.comment ? <span className="mt-0.5 block break-words text-[13.5px] text-chalk-dim">{e.comment}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>

        {filtered.length > limit ? (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE * 2)}
            className="mt-6 h-11 border border-line-bright px-6 font-display text-[11px] font-bold uppercase tracking-widest text-chalk transition hover:border-chalk"
          >
            Ver más comentarios
          </button>
        ) : null}
      </section>
    </>
  );
}
