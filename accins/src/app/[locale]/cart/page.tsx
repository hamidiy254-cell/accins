'use client';
import { useCart } from '@/store/cart';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Trash2, Plus, Minus } from 'lucide-react';

export default function CartPage() {
  const { items, remove, updateQty, total } = useCart();
  const t = useTranslations('cart'); const locale = useLocale();
  if (items.length === 0) return (
    <div className="max-w-2xl mx-auto text-center py-24">
      <p className="text-xl text-gray-500 mb-4">{t('empty')}</p>
      <Link href={`/${locale}/products`} className="text-indigo-600 font-semibold">← Voir les produits</Link>
    </div>
  );
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
      <div className="space-y-4">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-4 p-4 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
            {i.image_url && <img src={i.image_url} className="w-20 h-20 object-cover rounded-lg" alt="" />}
            <div className="flex-1">
              <h3 className="font-semibold">{i.name}</h3>
              <p className="text-indigo-600 font-bold">{i.price} DH</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => updateQty(i.id, i.quantity - 1)}
                className="p-1 border rounded dark:border-gray-700"><Minus size={16} /></button>
              <span className="w-8 text-center">{i.quantity}</span>
              <button onClick={() => updateQty(i.id, i.quantity + 1)}
                className="p-1 border rounded dark:border-gray-700"><Plus size={16} /></button>
            </div>
            <button onClick={() => remove(i.id)} className="text-red-500 p-2"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
      <div className="mt-8 p-6 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
        <div className="flex justify-between text-xl font-bold mb-4">
          <span>{t('total')}</span><span className="text-indigo-600">{total()} DH</span>
        </div>
        <Link href={`/${locale}/checkout`}
          className="block w-full text-center bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700">
          {t('checkout')}
        </Link>
      </div>
    </div>
  );
}