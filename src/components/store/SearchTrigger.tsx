'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconClose, IconSearch } from '@/components/ui/Icons';

const SUGGESTIONS = [
  { label: 'R-SKIN Jammer', href: '/producto/r-skin-jammer-ts703' },
  { label: 'R-SKIN Knee Suit', href: '/producto/r-skin-knee-suit-ts704' },
  { label: 'Trajes de hombre', href: '/catalogo?genero=MALE' },
  { label: 'Trajes de mujer', href: '/catalogo?genero=FEMALE' },
  { label: 'Guía de tallas', href: '/guia-de-tallas' },
];

export function SearchTrigger() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      // Atajo de teclado tipo buscador de escritorio.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    setOpen(false);
    router.push(q ? `/catalogo?q=${encodeURIComponent(q)}` : '/catalogo');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar productos"
        className="flex h-10 w-10 items-center justify-center text-chalk-dim transition-colors hover:text-chalk"
      >
        <IconSearch className="h-[19px] w-[19px]" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative mx-auto mt-[12vh] w-[92%] max-w-2xl animate-rise-in">
            <form onSubmit={submit} className="border border-line bg-ink-900 shadow-lift">
              <div className="flex items-center gap-3 border-b border-line px-5">
                <IconSearch className="h-5 w-5 shrink-0 text-chalk-faint" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar traje, modelo o código de homologación…"
                  aria-label="Buscar"
                  className="h-16 flex-1 bg-transparent text-[16px] text-chalk placeholder:text-chalk-faint/70 focus:outline-none"
                />
                <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar búsqueda" className="text-chalk-faint hover:text-chalk">
                  <IconClose className="h-5 w-5" />
                </button>
              </div>
              <div className="p-3">
                <p className="px-2 pb-2 pt-1 font-display text-[10px] uppercase tracking-mega text-chalk-faint">
                  Accesos rápidos
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.href}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(s.href);
                    }}
                    className="block w-full px-2 py-2.5 text-left text-[14px] text-chalk-dim hover:bg-ink-800 hover:text-chalk"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
