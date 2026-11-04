import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AddToCartButton } from './add-to-cart-button';
import { BackButton } from '@/components/back-button';
import { ProductGallery } from './gallery';
import { ShieldCheck, Truck, RefreshCw } from 'lucide-react';

export default async function ProductPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('product');
  const supabase = await createClient();
  const { data: product } = await supabase.from('products').select('*').eq('id', id).single();
  if (!product) notFound();

  const discount = product.old_price && product.price < product.old_price
    ? Math.round((1 - product.price / product.old_price) * 100)
    : 0;

  // On prepare l'array d'images
  const productImages = product.images?.length > 0 
    ? product.images 
    : (product.image_url ? [product.image_url] : []);

  return (
    <div className="container-custom py-8">
      <BackButton href={`/${locale}/products`} label={t('backToProducts')} className="mb-6" />
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        
        {/* Galerie d'images */}
        <div className="sticky top-24 self-start">
          <ProductGallery images={productImages} name={product.name} />
        </div>

        <div>
          {product.store && <p className="text-sm text-indigo-600 font-medium mb-2">{product.store}</p>}
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">{product.name}</h1>
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-display font-bold text-indigo-600">{product.price} DH</span>
            {product.old_price && <span className="text-xl line-through text-slate-400">{product.old_price} DH</span>}
          </div>
          {product.description && <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-8 whitespace-pre-line">{product.description}</p>}
          <div className="mb-6 flex items-center gap-2">
            {product.stock > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full" /> {t('inStock')} ({product.stock})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm text-red-600 font-medium">
                <span className="w-2 h-2 bg-red-500 rounded-full" /> {t('outOfStock')}
              </span>
            )}
          </div>
          <AddToCartButton product={product} />
          <div className="mt-8 grid grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <Truck size={18} className="text-indigo-600" />
              <span className="text-center">{t('features.delivery')}</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <ShieldCheck size={18} className="text-indigo-600" />
              <span className="text-center">{t('features.secure')}</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <RefreshCw size={18} className="text-indigo-600" />
              <span className="text-center">{t('features.return')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}