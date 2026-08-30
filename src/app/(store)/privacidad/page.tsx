import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { LegalPage } from '@/components/store/LegalPage';

export const metadata: Metadata = buildMetadata({
  title: 'Política de privacidad',
  path: '/privacidad',
});

export default async function PrivacyPage() {
  const settings = await getSettings();
  return (
    <LegalPage
      eyebrow="Legal"
      title="Política de privacidad"
      intro="Qué datos guardamos, para qué los usamos y cómo puedes pedirnos que los eliminemos."
      updatedAt="agosto de 2026"
    >
      <h2>Datos que recopilamos</h2>
      <ul>
        <li><strong>De la compra:</strong> nombre, correo, teléfono, RUT (si lo entregas) y dirección de despacho.</li>
        <li><strong>De la cuenta:</strong> los datos anteriores más tu historial de pedidos y direcciones guardadas.</li>
        <li><strong>De navegación:</strong> datos agregados de uso del sitio a través de herramientas de analítica.</li>
      </ul>
      <p>
        No almacenamos datos de tarjetas de crédito o débito. Esa información la procesa directamente
        Mercado Pago bajo sus propias políticas.
      </p>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Procesar y despachar tu pedido.</li>
        <li>Enviarte confirmaciones, avisos de despacho y seguimiento.</li>
        <li>Atender consultas y solicitudes de cambio.</li>
        <li>Enviarte novedades comerciales, solo si lo autorizaste.</li>
        <li>Mejorar el sitio mediante métricas agregadas.</li>
      </ul>

      <h2>Con quién los compartimos</h2>
      <p>
        Solo con quienes necesitan la información para completar el servicio: Mercado Pago para procesar
        el pago, y el courier que elegiste para el despacho. No vendemos ni cedemos tus datos a terceros
        con fines comerciales.
      </p>

      <h2>Analítica y publicidad</h2>
      <p>
        Podemos usar Google Analytics y Meta Pixel para medir el uso del sitio y la efectividad de
        nuestras campañas. Estas herramientas usan cookies. Puedes bloquearlas desde la configuración de
        tu navegador sin que eso afecte tu capacidad de comprar.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Conforme a la Ley 19.628 sobre Protección de la Vida Privada, puedes solicitar acceder,
        rectificar o eliminar tus datos personales. Escríbenos a {settings.contactEmail} y respondemos
        dentro de 10 días hábiles.
      </p>

      <h2>Conservación</h2>
      <p>
        Conservamos los datos de pedidos mientras exista obligación tributaria o legal de mantenerlos.
        Los datos de cuenta se eliminan cuando lo solicitas, salvo los asociados a pedidos ya emitidos.
      </p>
    </LegalPage>
  );
}
