import { IconWhatsapp } from '@/components/ui/Icons';

/**
 * Botón flotante de WhatsApp de taupoc.lat, abajo a la derecha. Usa el mismo
 * número que taupoc.cl (Panel → Ajustes → WhatsApp). Sin número, no aparece.
 */
export function WhatsAppButton({ phone }: { phone: string }) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const text = encodeURIComponent('Hola, les escribo desde taupoc.lat.');
  return (
    <a
      href={`https://wa.me/${digits}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-transform hover:scale-105 sm:right-6 sm:h-[60px] sm:w-[60px]"
    >
      <IconWhatsapp className="h-7 w-7" />
    </a>
  );
}
