'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';
import { sendMail } from '@/lib/mail';
import { getSettings } from '@/lib/settings';

export interface ContactState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

const schema = z.object({
  name: z.string().min(2, 'Ingresa tu nombre.'),
  email: z.string().email('Ingresa un correo válido.'),
  phone: z.string().optional(),
  subject: z.string().min(1, 'Selecciona un motivo.'),
  message: z.string().min(10, 'Cuéntanos un poco más.').max(2000),
  website: z.string().max(0).optional(),
});

export async function submitContact(
  _prev: ContactState | null,
  formData: FormData,
): Promise<ContactState> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!rateLimit(`contact:${ip}`, 5, 300_000)) {
    return { ok: false, message: 'Demasiados mensajes. Intenta de nuevo en unos minutos.' };
  }

  const raw = Object.fromEntries(formData) as Record<string, string>;
  if (raw.website) return { ok: true, message: 'Mensaje enviado.' };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: 'Revisa los datos marcados.', fieldErrors };
  }

  const data = parsed.data;
  const settings = await getSettings();
  const to = process.env.ADMIN_ALERT_EMAIL || settings.contactEmail;

  const escape = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  await sendMail({
    to,
    subject: `[TAUPOC] ${data.subject} — ${data.name}`,
    html: `<p><strong>De:</strong> ${escape(data.name)} &lt;${escape(data.email)}&gt;</p>
           <p><strong>Teléfono:</strong> ${escape(data.phone ?? '—')}</p>
           <p><strong>Motivo:</strong> ${escape(data.subject)}</p>
           <hr>
           <p>${escape(data.message).replace(/\n/g, '<br>')}</p>`,
    text: `${data.name} <${data.email}>\n${data.phone ?? ''}\n${data.subject}\n\n${data.message}`,
  });

  return {
    ok: true,
    message: 'Mensaje enviado. Te respondemos dentro de 24 horas hábiles.',
  };
}
