import { mediaSrcSet } from '@/lib/media-url';
import { cn } from '@/lib/utils';

/**
 * Imagen o video de fondo de un bloque del inicio.
 *
 * Se usa `<img>` y no next/image porque las imágenes del panel ya se sirven
 * optimizadas y en varios anchos desde /api/media: pasarlas otra vez por el
 * optimizador de Next sería reencodear lo ya reencodeado. Una dirección
 * externa se muestra tal cual llega.
 */
export function BlockMedia({
  imageUrl,
  imageMobileUrl,
  videoUrl,
  posterUrl,
  alt = '',
  fit,
  priority,
  className,
}: {
  imageUrl?: string | null;
  imageMobileUrl?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  alt?: string;
  fit?: string;
  priority?: boolean;
  className?: string;
}) {
  const object = fit === 'contain' ? 'object-contain' : 'object-cover';

  if (videoUrl) {
    return (
      <video
        // Sin `muted` ningún navegador deja que un video arranque solo.
        autoPlay
        muted
        loop
        playsInline
        preload={priority ? 'auto' : 'metadata'}
        poster={posterUrl ?? undefined}
        className={cn('h-full w-full', object, className)}
      >
        <source src={videoUrl} />
      </video>
    );
  }

  if (!imageUrl) return null;

  return (
    <picture>
      {imageMobileUrl ? (
        <source
          media="(max-width: 640px)"
          srcSet={mediaSrcSet(imageMobileUrl) ?? imageMobileUrl}
          sizes="100vw"
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        srcSet={mediaSrcSet(imageUrl)}
        sizes="100vw"
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        className={cn('h-full w-full', object, className)}
      />
    </picture>
  );
}
