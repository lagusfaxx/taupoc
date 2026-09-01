'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendTestMail } from '@/lib/mail';
import { PLANTILLAS_DE_PRUEBA, type PlantillaDePrueba } from '@/lib/mail-kinds';
import type { AdminState } from './products';

const IDS = PLANTILLAS_DE_PRUEBA.map((p) => p.id) as [PlantillaDePrueba, ...PlantillaDePrueba[]];

const schema = z.object({
  email: z.string().email('Ingresa un correo válido.'),
  kind: z.enum(IDS, { errorMap: () => ({ message: 'Elige una plantilla.' }) }),
});

/**
 * Manda una plantilla de prueba a la dirección que indique el admin.
 *
 * Sirve para revisar el diseño sin generar pedidos de verdad. El envío se
 * fuerza aunque la bandera de Configuración esté apagada: justamente se usa
 * para decidir si conviene encenderla.
 */
export async function sendTestEmail(
  _prev: AdminState | null,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse({
    email: formData.get('email'),
    kind: formData.get('kind'),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }

  // Cada envío gasta cuota del proveedor: 10 por minuto alcanza de sobra
  // para revisar plantillas y evita vaciarla con el dedo pegado al botón.
  if (!rateLimit(`mail-test:${admin.id}`, 10, 60_000)) {
    return { ok: false, message: 'Demasiadas pruebas seguidas. Espera un minuto.' };
  }

  const etiqueta = PLANTILLAS_DE_PRUEBA.find((p) => p.id === parsed.data.kind)?.label ?? '';

  try {
    const { enviado } = await sendTestMail(parsed.data.kind, parsed.data.email);
    if (!enviado) {
      return {
        ok: false,
        message:
          'No hay proveedor de correo configurado. Define RESEND_API_KEY o SMTP_HOST y vuelve a desplegar.',
      };
    }
    return { ok: true, message: `«${etiqueta}» enviado a ${parsed.data.email}.` };
  } catch (error) {
    console.error('[mail-test:error]', error);
    return { ok: false, message: 'El proveedor rechazó el envío. Revisa los logs del servidor.' };
  }
}
