'use client';
import { useCart } from '@/store/cart';
import { useHydrated } from '@/hooks/use-hydrated';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Trash2, Plus, Minus, Truck, CheckCircle2, ShoppingBag } from 'lucide-react';
import { BackButton } from '@/components/back-button';

const FREE_DELIVERY_THRESHOLD = 4;
const DELIVERY_FEE = 35;

export default function CartPage() {
  const { items, remove, updateQty, total } = useCart();
  const hydrated = useHydrated();
  const t = useTranslations('cart');
  const locale = useLocale();

  const itemCount = items.reduce((a, i) => a + i.quantity, 0);
  const deliveryFee = itemCount >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - itemCount);
  const grandTotal = total() + deliveryFee;

  if (!hydrated) {
    return (
      <div className="container-custom py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (items.length === 0) return (
    <div className="container-custom max-w-2xl text-center py-24">
      <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
      <p className="text-xl font-medium text-slate-600 dark:text-slate-400 mb-6">{t('empty')}</p>
      <Link href={`/${locale}/products`} className="inline-flex items-center justify-center bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
        {t('viewProducts')}
      </Link>
    </div>
  );

  return (
    <div className="container-custom py-8 max-w-4xl pb-28 md:pb-8">
      <BackButton href={`/${locale}/products`} label={t('continue')} className="mb-6" />
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>

      {itemCount < FREE_DELIVERY_THRESHOLD ? (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center gap-2 mb-2">
            <Truck size={18} className="text-indigo-600" />
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
              {t('freeProgress', { count: remaining })}
            </p>
          </div>
          <div className="w-full h-2 bg-white dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500" style={{ width: `${(itemCount / FREE_DELIVERY_THRESHOLD) * 100}%` }} />
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 flex items-center gap-2">
          <CheckCircle2 size={20} className="text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-900 dark:text-green-200">{t('freeCongrats')}</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 p-3 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 shadow-sm">
            {i.image_url && <img src={i.image_url} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg shrink-0" alt="" />}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate text-sm sm:text-base">{i.name}</h3>
              <p className="text-indigo-600 font-bold text-sm sm:text-base">{i.price} DH</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button onClick={() => updateQty(i.id, i.quantity - 1)} className="p-2 text-slate-600 hover:text-indigo-600 transition"><Minus size={14} /></button>
                <span className="w-6 text-center font-semibold text-sm">{i.quantity}</span>
                <button onClick={() => updateQty(i.id, i.quantity + 1)} className="p-2 text-slate-600 hover:text-indigo-600 transition"><Plus size={14} /></button>
              </div>
              <button onClick={() => remove(i.id)} className="text-xs text-red-500 font-medium hover:underline flex items-center gap-1"><Trash2 size={12}/> Retirer</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Summary */}
      <div className="hidden md:block mt-6 p-6 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 shadow-sm space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">{t('subtotal')}</span>
          <span className="font-medium">{total().toFixed(2)} DH</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Truck size={14} /> {t('delivery')}</span>
          {deliveryFee === 0 ? <span className="font-medium text-green-600">{t('free')}</span> : <span className="font-medium">{deliveryFee.toFixed(2)} DH</span>}
        </div>
        <div className="flex justify-between font-bold text-lg pt-3 border-t border-slate-200 dark:border-slate-700">
          <span>{t('total')}</span>
          <span className="text-indigo-600">{grandTotal.toFixed(2)} DH</span>
        </div>
        <Link href={`/${locale}/checkout`} className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold text-lg transition shadow-lg shadow-indigo-500/20">
          {t('checkout')}
        </Link>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 px-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-50 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">Total</p>
          <p className="font-bold text-xl text-indigo-600 leading-none mt-1">{grandTotal.toFixed(2)} DH</p>
        </div>
        <Link href={`/${locale}/checkout`} className="flex-1 max-w-[200px] text-center bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/30 active:scale-95 transition-transform">
          {t('checkout')}
        </Link>
      </div>
    </div>
  );
}