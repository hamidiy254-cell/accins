'use client';
import { useCart } from '@/store/cart';
import { useTranslations, useLocale } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';

export function AddToCartButton({ product }: { product: any }) {
  const t = useTranslations('product');
  const locale = useLocale();
  const add = useCart((s) => s.add);
  
  const localizedName = getLocalizedField(product, 'name', locale);
  const mainImage = product.images?.[0] || product.image_url;

  return (
    <button
      disabled={product.stock === 0}
      onClick={() => add({ id: product.id, name: localizedName, price: Number(product.price), image_url: mainImage, store: product.store })}
      className="w-full bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-indigo-500/30 active:scale-95"
    >
      {t('addToCart')}
    </button>
  );
}