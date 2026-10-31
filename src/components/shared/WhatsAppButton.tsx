import { IconWhatsapp } from '@/components/ui/Icons';

/**
 * Botón flotante de WhatsApp, abajo a la derecha, en taupoc.cl y taupoc.lat.
 * Usa el número de Panel → Ajustes → WhatsApp; sin número, no aparece.
 *
 * En el teléfono, cuando la ficha de producto muestra su barra de compra fija
 * (data-buy-bar), el botón sube para no tapar "Agregar".
 */
export function WhatsAppButton({ phone, message }: { phone: string; message: string }) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  return (
    <a
      href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-[transform,bottom] duration-300 hover:scale-105 sm:right-6 sm:h-[60px] sm:w-[60px] max-lg:[body:has([data-buy-bar][aria-hidden=false])_&]:bottom-[88px]"
    >
      <IconWhatsapp className="h-7 w-7" />
    </a>
  );
}
