/**
 * Esqueleto de la ficha.
 *
 * La página es dinámica, así que entre el clic y el HTML del servidor pasa
 * un momento en el que antes no cambiaba nada en pantalla: parecía que el
 * enlace no había respondido y se terminaba haciendo clic varias veces.
 */
export default function Loading() {
  return (
    <>
      <div className="border-b border-line-soft">
        <div className="container flex items-center gap-2 py-3.5">
          <div className="skeleton h-3 w-14" />
          <div className="skeleton h-3 w-16" />
          <div className="skeleton h-3 w-28" />
        </div>
      </div>

      <div className="container py-8 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-14 xl:gap-20">
          <div className="flex flex-col-reverse gap-3 lg:flex-row lg:gap-4">
            <div className="flex gap-3 lg:flex-col">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-20 w-20 shrink-0" />
              ))}
            </div>
            <div className="skeleton aspect-[4/5] w-full" />
          </div>

          <div>
            <div className="skeleton h-3 w-40" />
            <div className="mt-4 skeleton h-10 w-4/5" />
            <div className="mt-3 skeleton h-4 w-2/3" />
            <div className="mt-8 skeleton h-8 w-44" />

            <div className="mt-8 flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-10 w-10" />
              ))}
            </div>

            <div className="mt-8 grid grid-cols-5 gap-2 sm:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>

            <div className="mt-8 skeleton h-14 w-full" />
          </div>
        </div>
      </div>
    </>
  );
}
