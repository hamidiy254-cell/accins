'use client';
import { useState, useEffect } from 'react';
import { useCart } from '@/store/cart';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useLocale } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const t = useTranslations('checkout'); const locale = useLocale();
  const router = useRouter(); const supabase = createClient();
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState({ customer_name: '', phone: '', address: '', city: '', note: '' });
  const [coupon, setCoupon] = useState(''); const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) setForm({
        customer_name: profile.full_name || '', phone: profile.phone || '',
        address: profile.address || '', city: profile.city || '', note: '',
      });
    })();
  }, []);

  const applyCoupon = async () => {
    const { data } = await supabase.from('coupons').select('*')
      .eq('code', coupon.toUpperCase()).eq('is_active', true).single();
    if (!data) return setError('Code invalide');
    const d = data.discount_type === 'percent'
      ? (total() * data.discount_value) / 100 : data.discount_value;
    setDiscount(d); setAppliedCoupon(data.code); setError('');
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return setError('Panier vide');
    setLoading(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const totalFinal = Math.max(0, total() - discount);

    const { data: order, error: oerr } = await supabase.from('orders').insert({
      user_id: user?.id ?? null,
      customer_name: form.customer_name, phone: form.phone,
      address: form.address, city: form.city, note: form.note,
      store: items[0]?.store || null,
      coupon_code: appliedCoupon || null,
      subtotal: total(), discount, total: totalFinal, status: 'pending',
    }).select().single();

    if (oerr || !order) { setLoading(false); return setError(oerr?.message || 'Erreur'); }

    const orderItems = items.map((i) => ({
      order_id: order.id, product_id: i.id, product_name: i.name,
      quantity: i.quantity, unit_price: i.price, store: i.store,
    }));
    const { error: ierr } = await supabase.from('order_items').insert(orderItems);
    if (ierr) { setLoading(false); return setError(ierr.message); }

    clear(); setLoading(false);
    router.push(`/${locale}/checkout/success?order=${order.order_number}`);
  };

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
      <form onSubmit={placeOrder} className="space-y-4">
        <input required placeholder={t('name')} value={form.customer_name}
          onChange={(e) => update('customer_name', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input required placeholder={t('phone')} value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input required placeholder={t('address')} value={form.address}
          onChange={(e) => update('address', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input required placeholder={t('city')} value={form.city}
          onChange={(e) => update('city', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <textarea placeholder={t('note')} value={form.note}
          onChange={(e) => update('note', e.target.value)} rows={3}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />

        <div className="flex gap-2">
          <input placeholder={t('coupon')} value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
          <button type="button" onClick={applyCoupon}
            className="px-6 bg-gray-200 dark:bg-gray-700 rounded-lg">{t('apply')}</button>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
          <div className="flex justify-between"><span>Subtotal</span><span>{total()} DH</span></div>
          {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{discount} DH</span></div>}
          <div className="flex justify-between font-bold text-lg border-t dark:border-gray-700 pt-2">
            <span>Total</span><span className="text-indigo-600">{Math.max(0, total() - discount)} DH</span>
          </div>
        </div>

        {error && <p className="text-red-500">{error}</p>}
        <button disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
          {loading ? '...' : t('order')}
        </button>
      </form>
    </div>
  );
}