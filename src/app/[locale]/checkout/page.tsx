'use client';
import { useCart } from '@/store/cart';
import { useHydrated } from '@/hooks/use-hydrated';
import { useTranslations, useLocale } from 'next-intl';
import { CheckoutForm } from './checkout-form';
import { BackButton } from '@/components/back-button';
import { Truck } from 'lucide-react';

const FREE_DELIVERY_THRESHOLD = 4;
const DELIVERY_FEE = 35;

export default function CheckoutPage() {
  const { items, total } = useCart();
  const hydrated = useHydrated();
  const t = useTranslations('checkout');
  const locale = useLocale();
  const itemCount = items.reduce((a, i) => a + i.quantity, 0);
  const deliveryFee = itemCount >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

  return (
    <div className="container-custom py-8 max-w-4xl">
      <BackButton href={`/${locale}/cart`} label={t('backToCart')} className="mb-6" />
      <h1 className="font-display text-3xl font-bold mb-8">{t('title')}</h1>
      <div className="grid md:grid-cols-5 gap-6 md:gap-8">
        <div className="md:col-span-3 order-2 md:order-1"><CheckoutForm /></div>
        <div className="md:col-span-2 order-1 md:order-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sticky top-24">
            <h3 className="font-display font-bold mb-4">{t('recap')}</h3>
            {hydrated ? (
              items.length === 0 ? (
                <p className="text-sm text-slate-500">{t('emptyCart')}</p>
              ) : (
                <>
                  <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
                    {items.map((i) => (
                      <div key={i.id} className="flex gap-3 text-sm">
                        {i.image_url && <img src={i.image_url} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{i.name}</p>
                          <p className="text-slate-500 text-xs">x{i.quantity}</p>
                        </div>
                        <p className="font-semibold text-indigo-600 shrink-0">{(i.price * i.quantity).toFixed(2)} DH</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{t('subtotal')}</span>
                      <span>{total().toFixed(2)} DH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Truck size={14} /> {t('delivery')}</span>
                      {deliveryFee === 0 ? (
                        <span className="font-medium text-green-600">{t('free')}</span>
                      ) : (
                        <span>{deliveryFee.toFixed(2)} DH</span>
                      )}
                    </div>
                  </div>
                </>
              )
            ) : (
              <div className="space-y-3 animate-pulse">
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}