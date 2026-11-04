import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/product-card';
import { setRequestLocale } from 'next-intl/server';

export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products').select('*').eq('is_active', true).order('created_at', { ascending: false });
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {products?.map((p) => <ProductCard key={p.id} product={p} locale={locale} />)}
      </div>
    </div>
  );
}