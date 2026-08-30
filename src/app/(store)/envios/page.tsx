import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { formatCLP } from '@/lib/money';
import { regionName } from '@/lib/chile';
import { LegalPage } from '@/components/store/LegalPage';

// El encabezado lee el cookie del carrito: estas páginas ya se renderizan por
// solicitud. Declararlo permite compilar la imagen sin base de datos.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Envíos y plazos de entrega',
  description:
    'Despachamos a todo Chile con Chilexpress, Starken y Correos de Chile. Retiro sin costo en Santiago ' +
    'y entrega en torneo. Plazos, tarifas y cobertura por región.',
  path: '/envios',
});

export default async function ShippingPage() {
  const [zones, settings] = await Promise.all([
    prisma.shippingZone.findMany({
      where: { active: true },
      include: { rates: { where: { active: true }, orderBy: { price: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    }),
    getSettings(),
  ]);

  return (
    <LegalPage
      eyebrow="Ayuda"
      title="Envíos y plazos de entrega"
      intro="Despachamos a todo Chile. Los plazos se cuentan en días hábiles desde que se acredita el pago."
    >
      {settings.freeShippingOver ? (
        <p>
          <strong>Despacho sin costo</strong> en compras sobre {formatCLP(settings.freeShippingOver)},
          en las zonas con cobertura de nuestros couriers.
        </p>
      ) : null}

      <h2>Tarifas y plazos por zona</h2>
      {zones.map((zone) => (
        <div key={zone.id}>
          <h3>{zone.name}</h3>
          {zone.regions.length > 0 ? (
            <p className="text-[13.5px]">
              Cubre: {zone.regions.map((r) => regionName(r)).join(', ')}.
            </p>
          ) : null}
          <table>
            <thead>
              <tr>
                <th>Courier</th>
                <th>Servicio</th>
                <th>Plazo</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              {zone.rates.map((rate) => (
                <tr key={rate.id}>
                  <td>{rate.carrier}</td>
                  <td>{rate.label}</td>
                  <td>{rate.etaMinDays}–{rate.etaMaxDays} días hábiles</td>
                  <td>{rate.price === 0 ? 'Sin costo' : formatCLP(rate.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <h2>Retiro y entrega presencial</h2>
      <p>
        Puedes retirar tu pedido sin costo en nuestra oficina de Providencia, Santiago, o coordinar la
        entrega en el stand del próximo torneo. Al elegir cualquiera de estas opciones en el checkout,
        te contactamos para confirmar el horario.
      </p>

      <h2>Seguimiento</h2>
      <p>
        Cuando el pedido sale a despacho te enviamos un correo con el número de seguimiento del courier.
        También puedes verlo en cualquier momento en tu cuenta, dentro del detalle del pedido.
      </p>

      <h2>Zonas extremas e islas</h2>
      <p>
        Los despachos a Arica y Parinacota, Tarapacá, Antofagasta, Aysén y Magallanes tienen plazos
        mayores y tarifa diferenciada. Para Isla de Pascua y Juan Fernández, escríbenos antes de comprar
        para cotizar el envío.
      </p>
    </LegalPage>
  );
}
