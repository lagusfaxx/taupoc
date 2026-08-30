import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getLowStock } from '@/lib/inventory';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? '';
  // El login y el packing slip se renderizan sin el marco del panel.
  if (pathname.startsWith('/admin/ingresar')) return <>{children}</>;
  if (pathname.includes('/packing')) {
    const staff = await getCurrentUser();
    if (!staff || !isStaff(staff.role)) redirect('/admin/ingresar');
    return <>{children}</>;
  }

  const user = await getCurrentUser();
  if (!user) redirect('/admin/ingresar');
  if (!isStaff(user.role)) redirect('/admin/ingresar?error=permisos');

  const [pendingOrders, newQuotes, lowStock] = await Promise.all([
    prisma.order.count({ where: { status: { in: ['PAID', 'PROCESSING'] } } }),
    prisma.quoteRequest.count({ where: { status: 'NEW' } }),
    getLowStock(200).then((rows) => rows.length),
  ]);

  return (
    <AdminShell
      user={{ name: user.name, email: user.email, role: user.role }}
      pendingOrders={pendingOrders}
      newQuotes={newQuotes}
      lowStock={lowStock}
    >
      {children}
    </AdminShell>
  );
}
