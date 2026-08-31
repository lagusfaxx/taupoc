/** Mismo motivo que en la ficha: el catálogo es dinámico y el clic necesita
 *  una respuesta inmediata mientras el servidor arma la grilla. */
export default function Loading() {
  return (
    <>
      <div className="border-b border-line">
        <div className="container py-7">
          <div className="skeleton h-7 w-64" />
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10">
          <div className="hidden lg:block">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mb-8">
                <div className="skeleton h-3 w-24" />
                <div className="mt-3 skeleton h-24 w-full" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 lg:gap-x-6 xl:gap-x-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton aspect-[4/5] w-full" />
                <div className="mt-3.5 skeleton h-4 w-3/4" />
                <div className="mt-3 skeleton h-5 w-20" />
                <div className="mt-3.5 skeleton h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
