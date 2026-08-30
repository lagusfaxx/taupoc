'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveSpecs, saveSizeChart, type AdminState } from '@/actions/admin/products';
import { cn } from '@/lib/utils';
import { IconPlus, IconTrash } from '@/components/ui/Icons';

function Save({ label = 'Guardar' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 accent-bg px-5 font-display text-[11px] font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50"
    >
      {pending ? 'Guardando…' : label}
    </button>
  );
}

function Status({ state }: { state: AdminState | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={cn(
        'mb-3 border px-3.5 py-2.5 text-[13px]',
        state.ok
          ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok'
          : 'border-signal-bad/40 bg-signal-bad/10 text-signal-bad',
      )}
    >
      {state.message}
    </p>
  );
}

const input =
  'h-9 w-full border border-line bg-ink-900 px-2.5 text-[13px] text-chalk placeholder:text-chalk-faint/50 focus:border-[var(--accent)] focus:outline-none';

export function SpecsEditor({
  productId,
  specs,
}: {
  productId: string;
  specs: { label: string; value: string }[];
}) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveSpecs, null);
  const [rows, setRows] = useState(specs.length > 0 ? specs : [{ label: '', value: '' }]);

  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <Status state={state} />

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
            <input
              name="specLabel"
              defaultValue={row.label}
              placeholder="Compresión"
              aria-label={`Etiqueta ${i + 1}`}
              className={input}
            />
            <input
              name="specValue"
              defaultValue={row.value}
              placeholder="Alta — zona core y muslo"
              aria-label={`Valor ${i + 1}`}
              className={input}
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, index) => index !== i))}
              aria-label="Eliminar fila"
              className="flex h-9 w-9 items-center justify-center border border-line text-chalk-faint hover:border-signal-bad hover:text-signal-bad"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRows([...rows, { label: '', value: '' }])}
          className="inline-flex h-10 items-center gap-2 border border-line px-4 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim hover:border-line-bright hover:text-chalk"
        >
          <IconPlus className="h-4 w-4" />
          Agregar fila
        </button>
        <Save label="Guardar ficha técnica" />
      </div>
    </form>
  );
}

export interface ChartRow {
  size: string;
  chestMinCm: number | null; chestMaxCm: number | null;
  waistMinCm: number | null; waistMaxCm: number | null;
  hipMinCm: number | null; hipMaxCm: number | null;
  heightMinCm: number | null; heightMaxCm: number | null;
  cn: string | null; usa: string | null; uk: string | null; aus: string | null; nz: string | null;
}

const EMPTY_ROW: ChartRow = {
  size: '', chestMinCm: null, chestMaxCm: null, waistMinCm: null, waistMaxCm: null,
  hipMinCm: null, hipMaxCm: null, heightMinCm: null, heightMaxCm: null,
  cn: null, usa: null, uk: null, aus: null, nz: null,
};

export function SizeChartEditor({ productId, rows: initial }: { productId: string; rows: ChartRow[] }) {
  const [state, action] = useActionState<AdminState | null, FormData>(saveSizeChart, null);
  const [rows, setRows] = useState<ChartRow[]>(initial.length > 0 ? initial : [EMPTY_ROW]);

  const cell = 'h-9 w-full border border-line bg-ink-900 px-2 text-center text-[13px] text-chalk focus:border-[var(--accent)] focus:outline-none';

  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <Status state={state} />

      <p className="mb-3 text-[12.5px] text-chalk-faint">
        Medidas del cuerpo en centímetros. Las columnas CN, USA, UK, AUS y NZ son las equivalencias que
        ve el cliente en la ficha.
      </p>

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr>
              {['Talla', 'Pecho mín', 'Pecho máx', 'Cint. mín', 'Cint. máx', 'Cad. mín', 'Cad. máx', 'Est. mín', 'Est. máx', 'CN', 'USA', 'UK', 'AUS', 'NZ', ''].map((head) => (
                <th
                  key={head}
                  className="border-b border-line bg-ink-800 px-2 py-2 text-center font-display text-[9px] uppercase tracking-widest text-chalk-faint"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="border-b border-line-soft p-1">
                  <input name="rowSize" defaultValue={row.size} placeholder="28" aria-label={`Talla fila ${i + 1}`} className={cell} />
                </td>
                <td className="border-b border-line-soft p-1"><input name="chestMin" type="number" defaultValue={row.chestMinCm ?? ''} aria-label="Pecho mínimo" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="chestMax" type="number" defaultValue={row.chestMaxCm ?? ''} aria-label="Pecho máximo" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="waistMin" type="number" defaultValue={row.waistMinCm ?? ''} aria-label="Cintura mínima" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="waistMax" type="number" defaultValue={row.waistMaxCm ?? ''} aria-label="Cintura máxima" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="hipMin" type="number" defaultValue={row.hipMinCm ?? ''} aria-label="Cadera mínima" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="hipMax" type="number" defaultValue={row.hipMaxCm ?? ''} aria-label="Cadera máxima" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="heightMin" type="number" defaultValue={row.heightMinCm ?? ''} aria-label="Estatura mínima" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="heightMax" type="number" defaultValue={row.heightMaxCm ?? ''} aria-label="Estatura máxima" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="cn" defaultValue={row.cn ?? ''} aria-label="CN" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="usa" defaultValue={row.usa ?? ''} aria-label="USA" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="uk" defaultValue={row.uk ?? ''} aria-label="UK" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="aus" defaultValue={row.aus ?? ''} aria-label="AUS" className={cell} /></td>
                <td className="border-b border-line-soft p-1"><input name="nz" defaultValue={row.nz ?? ''} aria-label="NZ" className={cell} /></td>
                <td className="border-b border-line-soft p-1 text-center">
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((_, index) => index !== i))}
                    aria-label={`Eliminar fila ${i + 1}`}
                    className="text-chalk-faint hover:text-signal-bad"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRows([...rows, EMPTY_ROW])}
          className="inline-flex h-10 items-center gap-2 border border-line px-4 font-display text-[11px] font-semibold uppercase tracking-widest text-chalk-dim hover:border-line-bright hover:text-chalk"
        >
          <IconPlus className="h-4 w-4" />
          Agregar talla
        </button>
        <Save label="Guardar tabla de tallas" />
      </div>
    </form>
  );
}
