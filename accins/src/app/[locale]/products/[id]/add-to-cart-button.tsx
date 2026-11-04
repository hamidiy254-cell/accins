'use client';
import { useCart } from '@/store/cart';
import { useTranslations } from 'next-intl';

export function AddToCartButton({ product }: { product: any }) {
  const t = useTranslations('product');
  const add = useCart((s) => s.add);
  return (
    <button onClick={() => add({ id: product.id, name: product.name, price: Number(product.price),
      image_url: product.image_url, store: product.store })}
      className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700">
      {t('addToCart')}
    </button>
  );
}