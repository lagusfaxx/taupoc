import { mediaSrcSet } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import styles from './Hero.module.css';

export interface HeroData {
  imageUrl: string;
  imageMobileUrl?: string | null;
  alt?: string;
  title: string;
  body?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  tone: 'DARK' | 'LIGHT';
  /** Tamaño del título: S, M o L. */
  titleSize?: string;
  /** Punto de la foto que se mantiene al recortar, en porcentaje. */
  focalX?: number;
  focalY?: number;
}

/**
 * Banner de la portada de taupoc.lat. Lo usan la tienda y la vista previa
 * del panel; `device` fuerza la imagen de teléfono o escritorio en la vista
 * previa, donde el ancho de la pantalla no es el del marco.
 */
/**
 * Versiones para srcset más el original completo como la opción más grande:
 * en pantallas de alta densidad el banner necesita más que 1920 px.
 */
function srcSet(url: string): string | undefined {
  const set = mediaSrcSet(url);
  return set ? `${set}, ${url} 2560w` : undefined;
}

export function Hero({ data, device }: { data: HeroData; device?: 'desktop' | 'mobile' }) {
  const mobile = data.imageMobileUrl || data.imageUrl;
  // Sin imagen de teléfono, la horizontal se recorta para llenar una pantalla
  // vertical y se ve unas tres veces más ancha que la pantalla: se pide en
  // ese tamaño para que no se vea borrosa.
  const mobileSizes = data.imageMobileUrl ? '100vw' : '300vw';
  const objectPosition = `${data.focalX ?? 50}% ${data.focalY ?? 50}%`;
  const Title = device ? 'p' : 'h1';
  return (
    <section
      className={cn(
        styles.root,
        data.tone === 'LIGHT' && styles.light,
        data.titleSize === 'S' ? styles.sizeS : data.titleSize === 'L' ? styles.sizeL : styles.sizeM,
      )}
    >
      <div className={styles.slide}>
        <div className={styles.media}>
          {device ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={device === 'mobile' ? mobile : data.imageUrl}
              alt=""
              className={styles.image}
              style={{ objectPosition }}
            />
          ) : (
            <picture>
              <source media="(max-width: 767px)" srcSet={srcSet(mobile) ?? mobile} sizes={mobileSizes} />
              <img
                src={data.imageUrl}
                srcSet={srcSet(data.imageUrl)}
                sizes="100vw"
                alt={data.alt || data.title}
                fetchPriority="high"
                className={styles.image}
                style={{ objectPosition }}
              />
            </picture>
          )}
          <div className={styles.veil} />
        </div>
        <div className={styles.content}>
          <div className="mx-auto max-w-[1600px]">
            {data.title ? <Title className={styles.title}>{data.title}</Title> : null}
            {data.body ? <p className={styles.body}>{data.body}</p> : null}
            {data.ctaLabel && data.ctaHref ? (
              <a href={data.ctaHref} className={styles.cta}>
                {data.ctaLabel}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
