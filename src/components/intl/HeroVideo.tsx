'use client';

import { useEffect, useState } from 'react';

/**
 * Video de fondo del banner. Se elige en el navegador según el ancho
 * (teléfono o escritorio) y no se carga si la persona pidió reducir el
 * movimiento: entonces queda la imagen de portada.
 */
export function HeroVideo({
  src,
  mobileSrc,
  poster,
  className,
  style,
  device,
}: {
  src?: string | null;
  mobileSrc?: string | null;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  /** En la vista previa del panel el ancho de la pantalla no es el del marco. */
  device?: 'desktop' | 'mobile';
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setChosen(null);
    const mobile = device ? device === 'mobile' : window.matchMedia('(max-width: 767px)').matches;
    setChosen((mobile ? mobileSrc || src : src || mobileSrc) ?? null);
  }, [src, mobileSrc, device]);

  if (!chosen) return null;
  return (
    <video
      key={chosen}
      // Sin `muted` ningún navegador deja que un video arranque solo.
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster={poster || undefined}
      className={className}
      style={style}
    >
      <source src={chosen} />
    </video>
  );
}
