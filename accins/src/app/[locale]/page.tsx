import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/product-card';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products').select('*').eq('is_active', true)
    .order('created_at', { ascending: false }).limit(8);

  return (
    <div>
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">{t('title')}</h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90">{t('subtitle')}</p>
          <Link href={`/${locale}/products`}
            className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition">
            {t('shop')} →
          </Link>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products?.map((p) => <ProductCard key={p.id} product={p} locale={locale} />)}
        </div>
      </section>
    </div>
  );
}