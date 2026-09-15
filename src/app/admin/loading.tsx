/**
 * Lo que se ve mientras la página del panel se arma en el servidor.
 *
 * Sin esto la navegación no mostraba nada hasta que el servidor terminaba de
 * responder: el clic parecía no haber pasado y uno volvía a hacer clic. Con
 * este esqueleto el panel cambia de página al instante y el contenido llega
 * después.
 */
export default function Loading() {
  return (
    <div>
      <div className="skeleton h-7 w-56" />
      <div className="mt-3 skeleton h-4 w-96 max-w-full" />

      <div className="mt-8 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
