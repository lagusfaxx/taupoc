/**
 * Tabla de tallas de la ficha de taupoc.lat, plegada bajo las tallas. Las
 * medidas son del cuerpo: la fila donde caen es la talla que se compra.
 */
export interface IntlSizeRow {
  size: string;
  chestMinCm: number | null;
  chestMaxCm: number | null;
  waistMinCm: number | null;
  waistMaxCm: number | null;
  hipMinCm: number | null;
  hipMaxCm: number | null;
  heightMinCm: number | null;
  heightMaxCm: number | null;
  usa: string | null;
}

function range(min: number | null, max: number | null) {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min}–${max}`;
  return String(min ?? max);
}

export function IntlSizeTable({ rows }: { rows: IntlSizeRow[] }) {
  if (rows.length === 0) return null;
  const chest = rows.some((r) => r.chestMinCm != null);
  const hip = rows.some((r) => r.hipMinCm != null);
  const usa = rows.some((r) => r.usa);

  return (
    <details className="group mt-6 border-y border-hairline">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[15px] text-graphite">
        Tabla de tallas
        <span aria-hidden className="text-[20px] leading-none text-graphite-soft transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="pb-5">
        <p className="text-[14px] text-graphite-soft">
          Medidas de tu cuerpo en cm. La talla de la fila donde caes es la que compras.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-left text-[14px] tabular-nums">
            <thead>
              <tr className="text-[12px] text-graphite-soft">
                <th className="py-2 pr-3 font-normal">Talla</th>
                {chest ? <th className="py-2 pr-3 font-normal">Pecho</th> : null}
                <th className="py-2 pr-3 font-normal">Cintura</th>
                {hip ? <th className="py-2 pr-3 font-normal">Cadera</th> : null}
                <th className="py-2 pr-3 font-normal">Estatura</th>
                {usa ? <th className="py-2 font-normal">USA</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.size} className="border-t border-hairline">
                  <td className="py-2.5 pr-3 font-medium text-graphite">{r.size}</td>
                  {chest ? <td className="py-2.5 pr-3">{range(r.chestMinCm, r.chestMaxCm)}</td> : null}
                  <td className="py-2.5 pr-3">{range(r.waistMinCm, r.waistMaxCm)}</td>
                  {hip ? <td className="py-2.5 pr-3">{range(r.hipMinCm, r.hipMaxCm)}</td> : null}
                  <td className="py-2.5 pr-3">{range(r.heightMinCm, r.heightMaxCm)}</td>
                  {usa ? <td className="py-2.5 text-graphite-soft">{r.usa ?? '—'}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-graphite-soft">
          ¿Quedas entre dos tallas? Escríbenos por WhatsApp y te confirmamos antes de comprar.
        </p>
      </div>
    </details>
  );
}
