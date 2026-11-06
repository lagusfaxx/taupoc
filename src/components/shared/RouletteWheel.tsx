'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { spinRoulette, type SpinResult } from '@/actions/roulette';
import { cn } from '@/lib/utils';

type Theme = 'dark' | 'light';

const STORAGE_DONE = 'taupoc:ruleta:giro';
const STORAGE_SEEN = 'taupoc:ruleta:visto';
const HIDDEN_ON = ['/checkout', '/carrito', '/cuenta', '/devoluciones'];

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento la ruleta funciona igual, solo no recuerda */
  }
}

const PALETTE: Record<Theme, { a: string; b: string; textA: string; textB: string; rim: string; hub: string }> = {
  dark: { a: '#00E0B8', b: '#11151A', textA: '#07090B', textB: '#F4F6F8', rim: '#232A33', hub: '#07090B' },
  light: { a: '#111214', b: '#FFFFFF', textA: '#FFFFFF', textB: '#111214', rim: '#111214', hub: '#1A3CFF' },
};

function Wheel({ segments, rotation, theme }: { segments: { id: string; label: string }[]; rotation: number; theme: Theme }) {
  const n = segments.length;
  const seg = 360 / n;
  const c = PALETTE[theme];
  const point = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [100 + r * Math.cos(rad), 100 + r * Math.sin(rad)];
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]">
      {/* Puntero */}
      <svg viewBox="0 0 20 16" className="absolute left-1/2 top-[-6px] z-10 h-5 w-6 -translate-x-1/2" aria-hidden>
        <path d="M0 0h20L10 16z" fill={theme === 'dark' ? '#F4F6F8' : '#1A3CFF'} />
      </svg>
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 4.2s cubic-bezier(0.17, 0.84, 0.24, 1)',
        }}
        aria-hidden
      >
        <circle cx="100" cy="100" r="99" fill={c.rim} />
        {segments.map((s, i) => {
          const [x1, y1] = point(i * seg, 95);
          const [x2, y2] = point((i + 1) * seg, 95);
          const even = i % 2 === 0;
          const mid = i * seg + seg / 2;
          const [tx, ty] = point(mid, 62);
          return (
            <g key={s.id}>
              <path d={`M100 100 L${x1} ${y1} A95 95 0 0 1 ${x2} ${y2} Z`} fill={even ? c.a : c.b} />
              <text
                x={tx}
                y={ty}
                fill={even ? c.textA : c.textB}
                fontSize={s.label.length > 8 ? 9 : 12}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="middle"
                // Texto a lo largo del radio, leyendo desde el centro: queda
                // igual de legible en cualquier posición de la rueda.
                transform={`rotate(${mid - 90} ${tx} ${ty})`}
                style={{ fontFamily: 'inherit', letterSpacing: '0.04em' }}
              >
                {s.label}
              </text>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="14" fill={c.hub} stroke={theme === 'dark' ? '#00E0B8' : '#FFFFFF'} strokeWidth="3" />
      </svg>
    </div>
  );
}

/**
 * Ruleta de descuento a cambio del correo. Aparece como pestaña abajo a la
 * izquierda y se abre sola una vez, pasado un rato de navegación o al ir a
 * salir de la página. El premio lo decide el servidor; la rueda solo
 * muestra dónde cayó.
 */
export function RouletteWheel({
  segments,
  theme = 'dark',
  title,
  buttonLabel,
  autoOpenSeconds,
  exitIntent,
  snoozeDays,
}: {
  segments: { id: string; label: string }[];
  theme?: Theme;
  title: string;
  buttonLabel: string;
  /** 0: solo se abre con el botón. */
  autoOpenSeconds: number;
  exitIntent: boolean;
  /** Si se cerró sin girar, no vuelve a abrirse sola hasta pasados estos días. */
  snoozeDays: number;
}) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const autoOpened = useRef(false);

  const hidden = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    setDone(Boolean(read(STORAGE_DONE)));
    setReady(true);
  }, []);

  const autoOpen = useCallback(() => {
    if (autoOpened.current || done || hidden) return;
    const seen = Number(read(STORAGE_SEEN) ?? 0);
    if (seen && Date.now() - seen < snoozeDays * 86_400_000) return;
    autoOpened.current = true;
    setOpen(true);
  }, [done, hidden, snoozeDays]);

  useEffect(() => {
    if (!ready || done || hidden) return;
    const timer = autoOpenSeconds > 0 ? window.setTimeout(autoOpen, autoOpenSeconds * 1000) : null;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) autoOpen();
    };
    if (exitIntent) document.addEventListener('mouseout', onLeave);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('mouseout', onLeave);
    };
  }, [ready, done, hidden, autoOpen, autoOpenSeconds, exitIntent]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    if (!result) write(STORAGE_SEEN, String(Date.now()));
    setOpen(false);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (spinning) return;
    setError(null);
    setSpinning(true);
    const res = await spinRoulette(new FormData(e.currentTarget)).catch(
      (): SpinResult => ({ ok: false, message: 'No se pudo girar. Inténtalo de nuevo.' }),
    );
    if (!res.ok || res.index == null) {
      setSpinning(false);
      setError(res.message ?? 'No se pudo girar.');
      return;
    }
    const seg = 360 / segments.length;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = 360 * 6 - (res.index * seg + seg / 2) + jitter;
    setRotation((r) => r - (r % 360) + target);
    window.setTimeout(() => {
      setSpinning(false);
      setResult(res);
      setDone(true);
      write(STORAGE_DONE, res.code ?? '1');
    }, 4300);
  }

  if (!ready || hidden || segments.length === 0) return null;

  const dark = theme === 'dark';

  return (
    <>
      {!open && !done ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 z-50 flex h-12 items-center gap-2 px-4 text-[12px] font-bold uppercase tracking-widest shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-transform hover:scale-[1.03] sm:left-6',
            'max-lg:[body:has([data-buy-bar][aria-hidden=false])_&]:hidden',
            dark ? 'accent-bg text-ink' : 'rounded-full bg-graphite text-paper',
          )}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
          </svg>
          {buttonLabel}
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Ruleta de descuento">
          <div className={cn('absolute inset-0', dark ? 'bg-ink/85 backdrop-blur-sm' : 'bg-graphite/50')} onClick={close} aria-hidden />
          <div
            className={cn(
              'relative w-full max-w-md overflow-y-auto px-6 pb-7 pt-6 max-h-[94vh] sm:px-8',
              dark ? 'border border-line bg-ink-900 text-chalk' : 'bg-paper text-graphite sm:rounded-sm',
            )}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className={cn('absolute right-3 top-3 flex h-10 w-10 items-center justify-center text-[18px]', dark ? 'text-chalk-faint hover:text-chalk' : 'text-graphite-soft hover:text-graphite')}
            >
              ✕
            </button>

            <p className={cn('text-[12px] font-semibold uppercase tracking-widest', dark ? 'accent-text' : 'text-cobalt')}>
              Ruleta TAUPOC
            </p>
            <h2 className={cn('mt-1.5 text-[26px] leading-tight', dark && 'font-display tracking-tight')}>
              {result ? `Ganaste ${result.label}` : title}
            </h2>

            <div className="mt-5">
              <Wheel segments={segments} rotation={rotation} theme={theme} />
            </div>

            {result ? (
              <div className="mt-6 text-center">
                <p className={cn('text-[14px]', dark ? 'text-chalk-dim' : 'text-graphite-soft')}>
                  {result.repeated ? result.message : 'Tu código, también enviado a tu correo:'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(result.code ?? '').then(() => setCopied(true), () => {});
                  }}
                  className={cn(
                    'mt-3 w-full border-2 border-dashed py-3 text-[22px] font-bold tracking-[0.2em]',
                    dark ? 'accent-border text-chalk' : 'border-[#1A3CFF] text-graphite',
                  )}
                >
                  {result.code}
                </button>
                <p className={cn('mt-2 text-[12.5px]', dark ? 'text-chalk-faint' : 'text-graphite-soft')}>
                  {copied ? 'Copiado.' : 'Toca para copiar.'}
                  {result.endsAt
                    ? ` Vence el ${new Date(result.endsAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}.`
                    : ''}{' '}
                  Un solo uso.
                </p>
                <a
                  href="/catalogo"
                  onClick={() => setOpen(false)}
                  className={cn(
                    'mt-5 flex h-12 items-center justify-center text-[13px] font-bold uppercase tracking-widest',
                    dark ? 'accent-bg text-ink clip-notch-sm' : 'bg-graphite text-paper',
                  )}
                >
                  Usarlo ahora
                </a>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6">
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute h-0 w-0 opacity-0" />
                <label htmlFor="ruleta-email" className="sr-only">Correo</label>
                <div className="flex gap-2">
                  <input
                    id="ruleta-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    placeholder="tu@correo.com"
                    disabled={spinning}
                    className={cn(
                      'h-12 min-w-0 flex-1 border px-3 text-[16px] focus:outline-none',
                      dark
                        ? 'border-line bg-ink-800 text-chalk placeholder:text-chalk-faint focus:border-[var(--accent)]'
                        : 'border-hairline bg-white text-graphite placeholder:text-graphite-soft focus:border-graphite',
                    )}
                  />
                  <button
                    type="submit"
                    disabled={spinning}
                    className={cn(
                      'h-12 shrink-0 px-5 text-[13px] font-bold uppercase tracking-widest disabled:opacity-60',
                      dark ? 'accent-bg text-ink clip-notch-sm' : 'bg-graphite text-paper',
                    )}
                  >
                    {spinning ? 'Girando…' : 'Girar'}
                  </button>
                </div>
                {error ? <p role="alert" className="mt-2 text-[13px] text-[#E5484D]">{error}</p> : null}
                <p className={cn('mt-3 text-[12px] leading-relaxed', dark ? 'text-chalk-faint' : 'text-graphite-soft')}>
                  Un giro por correo. Te enviamos el código y, de vez en cuando, novedades y reposiciones.
                  Puedes darte de baja cuando quieras.
                </p>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
