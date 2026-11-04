'use client';
import Link from 'next/link';
import { useCart } from '@/store/cart';
import { useTranslations } from 'next-intl';
import { ShoppingCart } from 'lucide-react';

export function ProductCard({ product, locale }: { product: any; locale: string }) {
  const t = useTranslations('product');
  const add = useCart((s) => s.add);
  const discount = product.old_price && product.price < product.old_price
    ? Math.round((1 - product.price / product.old_price) * 100)
    : 0;
  const desc = (product.description || '').trim();
  const shortDesc = desc.length > 70 ? desc.slice(0, 70).trim() : desc;
  const hasMore = desc.length > 70;

  return (
    <div className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col">
      <Link href={`/${locale}/products/${product.id}`} className="block">
        <div className="relative aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden">
          { (product.images?.[0] || product.image_url) ? (
            <img src={product.images?.[0] || product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">{t('noImage')}</div>
          )}
          {discount > 0 && (
            <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">-{discount}%</div>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white font-bold">{t('outOfStock')}</span>
            </div>
          )}
        </div>
      </Link>
      <div className="p-3 md:p-4 flex flex-col flex-1">
        <Link href={`/${locale}/products/${product.id}`}>
          <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 transition text-sm md:text-base">{product.name}</h3>
        </Link>
        {desc && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            {shortDesc}
            {hasMore && (
              <Link href={`/${locale}/products/${product.id}`} className="text-indigo-600 ml-1 font-semibold hover:underline whitespace-nowrap">{t('more')}</Link>
            )}
          </p>
        )}
        <div className="flex items-baseline gap-2 mt-auto pt-3">
          <span className="text-lg md:text-xl font-display font-bold text-indigo-600">{product.price} DH</span>
          {product.old_price && <span className="text-xs md:text-sm line-through text-slate-400">{product.old_price} DH</span>}
        </div>
        <button
          disabled={product.stock === 0}
          onClick={() => add({ id: product.id, name: product.name, price: Number(product.price), image_url: product.image_url, store: product.store })}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-2 md:py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-600 dark:hover:bg-indigo-500 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart size={16} />
          <span className="hidden sm:inline">{t('addToCart')}</span>
          <span className="sm:hidden">{t('add')}</span>
        </button>
      </div>
    </div>
  );
}