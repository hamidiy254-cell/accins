'use client';
import Link from 'next/link';
import { useCart } from '@/store/cart';
import { useTranslations } from 'next-intl';
import { ShoppingCart } from 'lucide-react';

export function ProductCard({ product, locale }: { product: any; locale: string }) {
  const t = useTranslations('product');
  const add = useCart((s) => s.add);
  return (
    <div className="group rounded-2xl overflow-hidden border dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-xl transition-all">
      <Link href={`/${locale}/products/${product.id}`}>
        <div className="aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden">
          {product.image_url && (
            <img src={product.image_url} alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          )}
        </div>
      </Link>
      <div className="p-4">
        <h3 className="font-semibold truncate">{product.name}</h3>
        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="text-lg font-bold text-indigo-600">{product.price} DH</span>
            {product.old_price && (
              <span className="ml-2 text-sm line-through text-gray-400">{product.old_price} DH</span>
            )}
          </div>
        </div>
        <button
          onClick={() => add({ id: product.id, name: product.name, price: Number(product.price),
            image_url: product.image_url, store: product.store })}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition">
          <ShoppingCart size={16} /> {t('addToCart')}
        </button>
      </div>
    </div>
  );
}