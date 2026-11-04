import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Package, ShoppingBag, Ticket, LayoutDashboard, ArrowLeft, MessageSquare } from 'lucide-react';

export default async function AdminLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect(`/${locale}`);

  const { count: unreadMessages } = await supabase
    .from('contact_messages')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);

  return (
    <div className="container-custom py-8">
      <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition group mb-6">
        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition" />
        Retour a la boutique
      </Link>
      <div className="flex gap-6 flex-col md:flex-row">
        <aside className="md:w-60 shrink-0">
          <div className="md:sticky md:top-24">
            <div className="mb-4 px-4 py-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <p className="text-xs uppercase tracking-wider opacity-80">Connecte en tant que</p>
              <p className="font-display font-bold truncate">Administrateur</p>
            </div>
            <nav className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
              <AdminLink href="" icon={<LayoutDashboard size={18} />} label="Dashboard" locale={locale} />
              <AdminLink href="/products" icon={<Package size={18} />} label="Produits" locale={locale} />
              <AdminLink href="/orders" icon={<ShoppingBag size={18} />} label="Commandes" locale={locale} />
              <AdminLink href="/coupons" icon={<Ticket size={18} />} label="Coupons" locale={locale} />
              <AdminLink href="/messages" icon={<MessageSquare size={18} />} label="Messages" locale={locale} badge={unreadMessages || 0} />
            </nav>
          </div>
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

function AdminLink({ href, icon, label, locale, badge }: { href: string; icon: React.ReactNode; label: string; locale: string; badge?: number }) {
  return (
    <Link href={`/${locale}/admin${href}`}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
      {icon}{label}
      {badge && badge > 0 ? (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}