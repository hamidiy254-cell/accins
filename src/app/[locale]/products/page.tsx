import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/product-card';
import { BackButton } from '@/components/back-button';
import { setRequestLocale } from 'next-intl/server';

export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products').select('*').eq('is_active', true).order('created_at', { ascending: false });

  return (
    <div>
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="container-custom py-8 md:py-10">
          <BackButton href={`/${locale}`} label="Accueil" className="mb-4" />
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Tous les produits</h1>
          <p className="text-slate-500">{products?.length || 0} article(s) disponible(s)</p>
        </div>
      </div>
      <div className="container-custom py-10">
        {products && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((p) => <ProductCard key={p.id} product={p} locale={locale} />)}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">
            Aucun produit disponible.
          </div>
        )}
      </div>
    </div>
  );
}