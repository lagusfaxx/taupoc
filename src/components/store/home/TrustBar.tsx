import { getSettings } from '@/lib/settings';
import { formatCLP } from '@/lib/money';
import { IconCheck, IconShield, IconTag, IconTruck } from '@/components/ui/Icons';

/**
 * Las cuatro razones para comprar acá, pegadas bajo la portada: despacho,
 * homologación, cambio de talla y pago. Sale de Ajustes, así que el umbral de
 * envío gratis y el descuento por transferencia nunca quedan desfasados.
 */
export async function TrustBar() {
  const s = await getSettings();
  const transfer = s.transferEnabled && s.transferDiscount > 0;

  const items = [
    {
      icon: IconTruck,
      title: s.freeShippingOver ? `Envío gratis sobre ${formatCLP(s.freeShippingOver)}` : 'Despacho a todo Chile',
      text: 'A todo Chile en 1 a 8 días hábiles',
    },
    {
      icon: IconShield,
      title: 'Homologados World Aquatics',
      text: 'Código verificable en cada ficha',
    },
    {
      icon: IconCheck,
      title: 'Cambio de talla sin costo',
      text: 'Dentro de 10 días, sin uso',
    },
    {
      icon: IconTag,
      title: transfer ? `${s.transferDiscount}% menos con transferencia` : `Hasta ${s.installmentsMax} cuotas`,
      text: transfer ? `O hasta ${s.installmentsMax} cuotas con Mercado Pago` : 'Crédito y débito con Mercado Pago',
    },
  ];

  return (
    <section aria-label="Por qué comprar en TAUPOC Chile" className="border-b border-line bg-ink-900">
      <ul className="container grid grid-cols-2 gap-x-4 gap-y-5 py-5 lg:grid-cols-4 lg:gap-x-8 lg:py-6">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <item.icon className="mt-0.5 h-5 w-5 shrink-0 accent-text" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug text-chalk lg:text-[14px]">{item.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-chalk-faint lg:text-[12.5px]">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
