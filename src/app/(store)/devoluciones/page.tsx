import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { LegalPage } from '@/components/store/LegalPage';

export const metadata: Metadata = buildMetadata({
  title: 'Cambios y devoluciones',
  description:
    'Política de cambios y devoluciones de TAUPOC Chile: cambio de talla sin costo dentro de 10 días, ' +
    'condiciones y cómo solicitarlo.',
  path: '/devoluciones',
});

export default function ReturnsPage() {
  return (
    <LegalPage
      eyebrow="Ayuda"
      title="Cambios y devoluciones"
      intro="La talla es el punto crítico de este rubro. Por eso el cambio de talla es sin costo dentro de los primeros 10 días."
      updatedAt="agosto de 2026"
    >
      <h2>Cambio de talla</h2>
      <p>
        Tienes <strong>10 días corridos</strong> desde que recibes el pedido para solicitar un cambio de
        talla, sin costo para ti dentro de la Región Metropolitana. En regiones cubrimos el despacho de
        vuelta y tú cubres el envío de regreso a nuestra bodega.
      </p>

      <h3>Condiciones</h3>
      <ul>
        <li>El traje debe estar <strong>sin uso</strong>, sin haber entrado al agua.</li>
        <li>Debe conservar la <strong>etiqueta original</strong> y el empaque.</li>
        <li>No debe presentar roturas, tirones de uña, manchas ni olor a cloro.</li>
        <li>Sujeto a disponibilidad de la talla solicitada.</li>
      </ul>

      <h3>Cómo solicitarlo</h3>
      <ol>
        <li>Escríbenos indicando el número de pedido y la talla que necesitas.</li>
        <li>Te confirmamos disponibilidad y te enviamos las instrucciones de envío.</li>
        <li>Al recibir el traje lo revisamos y despachamos el reemplazo dentro de 2 días hábiles.</li>
      </ol>

      <h2>Derecho a retracto</h2>
      <p>
        De acuerdo con la Ley 19.496 de Protección de los Derechos de los Consumidores, tienes derecho a
        retractarte de una compra realizada por medios electrónicos dentro de los 10 días corridos desde
        la recepción del producto, siempre que el producto no haya sido usado y se encuentre en las
        condiciones descritas arriba. El reembolso se realiza al mismo medio de pago utilizado.
      </p>

      <h2>Productos con falla</h2>
      <p>
        Si el traje presenta una falla de fabricación —costura abierta, bonding despegado, defecto del
        tejido— cámbialo o devuélvelo dentro de los primeros 3 meses. Cubrimos el despacho en ambos
        sentidos. Escríbenos con fotos del defecto y el número de pedido.
      </p>
      <p>
        El desgaste natural del tejido por uso en piscinas cloradas, la pérdida de compresión después de
        25 a 30 carreras y las roturas provocadas al ponerse el traje no constituyen falla de fabricación.
      </p>

      <h2>Reembolsos</h2>
      <p>
        Los reembolsos se procesan a través de Mercado Pago, al mismo medio de pago utilizado en la
        compra. El plazo depende del emisor de la tarjeta y suele tomar entre 5 y 15 días hábiles.
      </p>
    </LegalPage>
  );
}
