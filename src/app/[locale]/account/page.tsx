import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AccountClient } from './account-client';

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const { data: orders } = await supabase.from('orders')
    .select('*, order_items(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return <AccountClient user={user} profile={profile} orders={orders || []} locale={locale} />;
}