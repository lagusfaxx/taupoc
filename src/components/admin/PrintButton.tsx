'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-10 bg-black px-5 text-[11px] font-bold uppercase tracking-widest text-white"
    >
      Imprimir
    </button>
  );
}
