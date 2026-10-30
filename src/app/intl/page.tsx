/**
 * Portada provisional de taupoc.lat. Se reemplaza por la portada real con
 * el catálogo; mientras tanto el sitio no se indexa (ver layout raíz).
 */
export default function IntlHome() {
  return (
    <section className="mx-auto max-w-[1600px] px-4 pb-24 pt-16 sm:px-8 sm:pt-28">
      <h1 className="max-w-[14ch] text-[clamp(44px,8vw,128px)] leading-[0.95]">
        Trajes de competencia para nadar más rápido.
      </h1>
      <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-graphite-soft">
        Jammers y knee suits homologados por World Aquatics, con envío a toda Latinoamérica.
      </p>
    </section>
  );
}
