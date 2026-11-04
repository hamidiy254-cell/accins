import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AddToCartButton } from './add-to-cart-button';
import { ProductGallery } from './gallery';
import { ShieldCheck, Truck, RefreshCw, ChevronRight, Star, Store } from 'lucide-react';
import Link from 'next/link';
import { getLocalizedField } from '@/lib/i18n-utils';

export default async function ProductPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('product');
  const supabase = await createClient();
  const { data: product } = await supabase.from('products').select('*').eq('id', id).single();
  
  if (!product) notFound();

  const localizedName = getLocalizedField(product, 'name', locale);
  const localizedDesc = getLocalizedField(product, 'description', locale);

  const discount = product.old_price && product.price < product.old_price
    ? Math.round((1 - product.price / product.old_price) * 100)
    : 0;

  const productImages = product.images?.length > 0 
    ? product.images 
    : (product.image_url ? [product.image_url] : []);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="container-custom py-6 md:py-10">
        
        <nav className="flex items-center gap-2 text-xs md:text-sm text-slate-500 mb-6 md:mb-8 overflow-x-auto whitespace-nowrap pb-2">
          <Link href={`/${locale}`} className="hover:text-indigo-600 transition">Accueil</Link>
          <ChevronRight size={14} />
          <Link href={`/${locale}/products`} className="hover:text-indigo-600 transition">Produits</Link>
          <ChevronRight size={14} />
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{localizedName}</span>
        </nav>

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
          
          <div className="lg:col-span-7">
            <ProductGallery images={productImages} name={localizedName} />
          </div>

          <div className="lg:col-span-5 relative">
            <div className="lg:sticky lg:top-24 space-y-6">
              
              {product.store && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider border border-indigo-100 dark:border-indigo-900/50">
                  <Store size={14} /> {product.store}
                </div>
              )}

              <h1 className="font-display text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                {localizedName}
              </h1>

              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => <Star key={s} size={16} className="fill-yellow-400 text-yellow-400" />)}
                </div>
                <span className="text-sm text-slate-500 font-medium">(Satisfaction garantie)</span>
              </div>

              <div className="flex items-end gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <span className="text-4xl font-display font-black text-indigo-600">{product.price} DH</span>
                {product.old_price && (
                  <div className="flex flex-col mb-1">
                    <span className="text-lg line-through text-slate-400 font-medium">{product.old_price} DH</span>
                  </div>
                )}
                {discount > 0 && (
                  <span className="mb-2 ml-auto bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-md">-{discount}%</span>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Description</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm whitespace-pre-line">
                  {localizedDesc || "Aucune description fournie pour ce produit."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {product.stock > 0 ? (
                  <span className="inline-flex items-center gap-2 text-sm text-green-700 dark:text-green-400 font-bold bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-900/50">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" /> 
                    {t('inStock')} — Prêt à être expédié
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-sm text-red-700 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full" /> 
                    {t('outOfStock')} — Bientôt de retour
                  </span>
                )}
              </div>

              <div className="pt-2">
                <AddToCartButton product={product} />
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0"><Truck size={16} className="text-indigo-600" /></div>
                  <span><strong>Livraison Rapide</strong> — 35 DH (Gratuite dès 4 produits)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0"><ShieldCheck size={16} className="text-indigo-600" /></div>
                  <span><strong>Paiement à la livraison</strong> — 100% sécurisé</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0"><RefreshCw size={16} className="text-indigo-600" /></div>
                  <span><strong>Retour 7 jours</strong> — Satisfait ou remboursé</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}