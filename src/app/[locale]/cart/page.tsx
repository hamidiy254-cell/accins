'use client';
import { useCart } from '@/store/cart';
import { useHydrated } from '@/hooks/use-hydrated';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Trash2, Plus, Minus, Truck, CheckCircle2 } from 'lucide-react';
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
      <p className="text-xl text-gray-500 mb-4">{t('empty')}</p>
      <Link href={`/${locale}/products`} className="text-indigo-600 font-semibold hover:underline">{t('viewProducts')}</Link>
    </div>
  );

  return (
    <div className="container-custom py-8 max-w-4xl">
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
          <div key={i.id} className="flex items-start sm:items-center gap-3 p-3 sm:p-4 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
            {i.image_url && <img src={i.image_url} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg shrink-0" alt="" />}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate text-sm sm:text-base">{i.name}</h3>
              <p className="text-indigo-600 font-bold text-sm sm:text-base">{i.price} DH</p>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(i.id, i.quantity - 1)} className="p-1.5 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"><Minus size={14} /></button>
                <span className="w-7 text-center font-medium text-sm">{i.quantity}</span>
                <button onClick={() => updateQty(i.id, i.quantity + 1)} className="p-1.5 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"><Plus size={14} /></button>
              </div>
              <button onClick={() => remove(i.id)} className="text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-5 sm:p-6 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">{t('subtotal')}</span>
          <span className="font-medium">{total().toFixed(2)} DH</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Truck size={14} /> {t('delivery')}</span>
          {deliveryFee === 0 ? (
            <span className="font-medium text-green-600">{t('free')}</span>
          ) : (
            <span className="font-medium">{deliveryFee.toFixed(2)} DH</span>
          )}
        </div>
        <div className="flex justify-between font-bold text-lg pt-3 border-t border-slate-200 dark:border-slate-700">
          <span>{t('total')}</span>
          <span className="text-indigo-600">{grandTotal.toFixed(2)} DH</span>
        </div>
        <Link href={`/${locale}/checkout`} className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition shadow-lg shadow-indigo-500/20">{t('checkout')}</Link>
      </div>
    </div>
  );
}