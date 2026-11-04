'use client';
import { useState, useEffect, useMemo } from 'react';
import { useCart } from '@/store/cart';
import { useHydrated } from '@/hooks/use-hydrated';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { X, Truck, Banknote } from 'lucide-react';

const FREE_DELIVERY_THRESHOLD = 4;
const DELIVERY_FEE = 35;

export function CheckoutForm() {
  const { items, total, clear } = useCart();
  const hydrated = useHydrated();
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ customer_name: '', phone: '', address: '', city: '', note: '' });
  const [coupon, setCoupon] = useState('');
  const [appliedCouponData, setAppliedCouponData] = useState<any>(null);

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

  const itemCount = items.reduce((a, i) => a + i.quantity, 0);
  const deliveryFee = itemCount >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - itemCount);

  const discount = useMemo(() => {
    if (!appliedCouponData) return 0;
    const ids = appliedCouponData.product_ids;
    const eligible = ids && ids.length > 0 ? items.filter(i => ids.includes(i.id)) : items;
    if (eligible.length === 0) return 0;
    const eligibleTotal = eligible.reduce((s, i) => s + i.price * i.quantity, 0);
    const d = appliedCouponData.discount_type === 'percent'
      ? (eligibleTotal * Number(appliedCouponData.discount_value)) / 100
      : Number(appliedCouponData.discount_value);
    return Math.min(d, eligibleTotal);
  }, [appliedCouponData, items]);

  const grandTotal = Math.max(0, total() - discount) + deliveryFee;

  const applyCoupon = async () => {
    setError('');
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    const { data } = await supabase.from('coupons').select('*').eq('code', code).eq('is_active', true).single();
    if (!data) return setError(t('invalidCoupon'));
    const ids = data.product_ids;
    const eligible = ids && ids.length > 0 ? items.filter(i => ids.includes(i.id)) : items;
    if (eligible.length === 0) return setError(t('couponNotApplicable'));
    setAppliedCouponData(data);
  };

  const removeCoupon = () => {
    setAppliedCouponData(null);
    setCoupon('');
    setError('');
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return setError(t('emptyCart'));
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const productIds = items.map(i => i.id);
      const { data: prods } = await supabase.from('products').select('id, sku').in('id', productIds);
      const skuMap: Record<string, string | null> = {};
      (prods || []).forEach((p: any) => { skuMap[p.id] = p.sku; });

      const { data: order, error: oerr } = await supabase.from('orders').insert({
        user_id: user?.id ?? null,
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        note: form.note.trim() || null,
        store: items[0]?.store || null,
        coupon_code: appliedCouponData?.code || null,
        subtotal: total(),
        discount,
        delivery_fee: deliveryFee,
        total: grandTotal,
        status: 'pending',
      }).select().single();

      if (oerr) {
        if (oerr.message.includes('row-level security')) {
          throw new Error('RLS error. Execute the SQL script in Supabase.');
        }
        throw new Error(oerr.message);
      }
      if (!order) throw new Error('Order not created');

      const orderItems = items.map((i) => ({
        order_id: order.id,
        product_id: i.id,
        product_name: i.name,
        product_sku: skuMap[i.id] || null,
        quantity: i.quantity,
        unit_price: i.price,
        store: i.store || null,
      }));

      const { error: ierr } = await supabase.from('order_items').insert(orderItems);
      if (ierr) {
        await supabase.from('orders').delete().eq('id', order.id);
        throw new Error(ierr.message);
      }

      clear();
      router.push(`/${locale}/checkout/success?order=${order.order_number}`);
    } catch (err: any) {
      setError(err.message || 'Error');
      setLoading(false);
    }
  };

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });
  const inputClass = "w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition";

  return (
    <form onSubmit={placeOrder} className="space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0"><Banknote size={20} /></div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-green-900 dark:text-green-200">{t('cod')}</p>
          <p className="text-xs text-green-700 dark:text-green-400">{t('codSub')}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">{t('name')} <span className="text-red-500">*</span></label>
        <input required placeholder={t('fullNamePlaceholder')} value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">{t('phone')} <span className="text-red-500">*</span></label>
        <input required type="tel" inputMode="tel" placeholder={t('phonePlaceholder')} value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">{t('address')} <span className="text-red-500">*</span></label>
        <input required placeholder={t('addressPlaceholder')} value={form.address} onChange={(e) => update('address', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">{t('city')} <span className="text-red-500">*</span></label>
        <input required placeholder={t('cityPlaceholder')} value={form.city} onChange={(e) => update('city', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">{t('note')}</label>
        <textarea placeholder={t('notePlaceholder')} value={form.note} onChange={(e) => update('note', e.target.value)} rows={3} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">{t('coupon')}</label>
        {appliedCouponData ? (
          <div className="flex items-center justify-between gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl">
            <div>
              <p className="text-sm font-mono font-bold text-green-700 dark:text-green-400">{appliedCouponData.code}</p>
              <p className="text-xs text-green-600 dark:text-green-500">{t('couponApplied', { discount: discount.toFixed(2) })}</p>
            </div>
            <button type="button" onClick={removeCoupon} className="p-1.5 text-green-700 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg transition"><X size={16} /></button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input placeholder={t('couponPlaceholder')} value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} className={`${inputClass} flex-1`} />
            <button type="button" onClick={applyCoupon} className="px-6 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl font-medium transition">{t('apply')}</button>
          </div>
        )}
      </div>

      {hydrated ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">{t('subtotal')} ({t('itemsCount', { count: itemCount })})</span>
            <span className="font-medium">{total().toFixed(2)} DH</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>{t('discount')}</span><span>-{discount.toFixed(2)} DH</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Truck size={14} /> {t('delivery')}</span>
            {deliveryFee === 0 ? (
              <span className="font-medium text-green-600">{t('free')}</span>
            ) : (
              <span className="font-medium">{deliveryFee.toFixed(2)} DH</span>
            )}
          </div>
          {itemCount < FREE_DELIVERY_THRESHOLD && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 pt-1">{t('addMoreFree', { count: remaining })}</p>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200 dark:border-slate-700">
            <span>{t('total')}</span><span className="text-indigo-600">{grandTotal.toFixed(2)} DH</span>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl animate-pulse h-28" />
      )}

      {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">{error}</div>}

      <button disabled={loading || !hydrated} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold disabled:opacity-50 transition shadow-lg shadow-indigo-500/20">
        {loading ? t('processing') : t('order')}
      </button>
      <p className="text-xs text-center text-slate-500">{t('confirmPay', { total: grandTotal.toFixed(2) })}</p>
    </form>
  );
}