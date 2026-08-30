import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { LegalPage } from '@/components/store/LegalPage';

export const metadata: Metadata = buildMetadata({
  title: 'Términos y condiciones',
  path: '/terminos',
});

export default async function TermsPage() {
  const settings = await getSettings();
  return (
    <LegalPage eyebrow="Legal" title="Términos y condiciones" updatedAt="agosto de 2026">
      <h2>1. Sobre este sitio</h2>
      <p>
        {settings.storeName} opera esta tienda en línea como distribuidor oficial de TAUPOC Swimwear en
        Chile. Al comprar aceptas estos términos.
      </p>

      <h2>2. Precios y disponibilidad</h2>
      <p>
        Todos los precios se expresan en pesos chilenos (CLP) e incluyen IVA. Los precios y la
        disponibilidad pueden cambiar sin aviso previo. El stock mostrado corresponde a la disponibilidad
        real al momento de la consulta; si un producto se agota entre la compra y la preparación del
        pedido, te contactamos para ofrecerte una alternativa o el reembolso completo.
      </p>

      <h2>3. Pago</h2>
      <p>
        Los pagos se procesan a través de Mercado Pago. No almacenamos datos de tarjetas en nuestros
        servidores. El pedido se confirma solo cuando el pago queda acreditado. Un pago en revisión no
        reserva stock.
      </p>

      <h2>4. Homologación</h2>
      <p>
        Publicamos el código de homologación de World Aquatics de cada modelo, y el enlace al registro
        oficial para que puedas verificarlo de forma independiente. La vigencia de la homologación
        depende exclusivamente de World Aquatics y puede cambiar sin aviso; recomendamos verificar el
        código antes de cada competencia importante.
      </p>

      <h2>5. Envíos</h2>
      <p>
        Los plazos publicados son estimados en días hábiles y dependen del courier. No somos responsables
        por retrasos atribuibles al operador logístico, condiciones climáticas o fuerza mayor.
      </p>

      <h2>6. Cambios y devoluciones</h2>
      <p>
        Se rigen por nuestra política de cambios y devoluciones y por la Ley 19.496 de Protección de los
        Derechos de los Consumidores.
      </p>

      <h2>7. Cupones</h2>
      <p>
        Los cupones son personales, no acumulables entre sí salvo indicación expresa, y pueden tener
        fecha de vencimiento, monto mínimo de compra o límite de usos. Nos reservamos el derecho de
        anular cupones usados de manera fraudulenta.
      </p>

      <h2>8. Propiedad intelectual</h2>
      <p>
        Las marcas, logotipos, fotografías y contenidos de este sitio pertenecen a sus respectivos
        titulares y no pueden reproducirse sin autorización.
      </p>

      <h2>9. Contacto</h2>
      <p>
        Para cualquier consulta sobre estos términos escríbenos a {settings.contactEmail}.
      </p>
    </LegalPage>
  );
}
