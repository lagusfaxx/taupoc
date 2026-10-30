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
}

/**
 * Banner de la portada de taupoc.lat. Lo usan la tienda y la vista previa
 * del panel; `device` fuerza la imagen de teléfono o escritorio en la vista
 * previa, donde el ancho de la pantalla no es el del marco.
 */
export function Hero({ data, device }: { data: HeroData; device?: 'desktop' | 'mobile' }) {
  const mobile = data.imageMobileUrl || data.imageUrl;
  const Title = device ? 'p' : 'h1';
  return (
    <section className={cn(styles.root, data.tone === 'LIGHT' && styles.light)}>
      <div className={styles.slide}>
        <div className={styles.media}>
          {device ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={device === 'mobile' ? mobile : data.imageUrl} alt="" className={styles.image} />
          ) : (
            <picture>
              <source media="(max-width: 767px)" srcSet={mediaSrcSet(mobile) ?? mobile} sizes="100vw" />
              <img
                src={data.imageUrl}
                srcSet={mediaSrcSet(data.imageUrl)}
                sizes="100vw"
                alt={data.alt || data.title}
                fetchPriority="high"
                className={styles.image}
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
