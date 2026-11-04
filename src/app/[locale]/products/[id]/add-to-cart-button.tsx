'use client';
import { useCart } from '@/store/cart';
import { useTranslations } from 'next-intl';

export function AddToCartButton({ product }: { product: any }) {
  const t = useTranslations('product');
  const add = useCart((s) => s.add);
  return (
    <button
      disabled={product.stock === 0}
      onClick={() => add({ id: product.id, name: product.name, price: Number(product.price), image_url: product.image_url, store: product.store })}
      className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-indigo-500/20"
    >
      {t('addToCart')}
    </button>
  );
}