import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/product-card';
import { Truck, ShieldCheck, RefreshCw, Headphones, ArrowRight, Star, Quote } from 'lucide-react';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const supabase = await createClient();
  const [{ data: products }, { count: orderCount }, { count: productCount }] = await Promise.all([
    supabase.from('products').select('*').eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false }).limit(8),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }),
  ]);

  const testimonials = [
    { name: 'Sara M.', city: 'Casablanca', text: 'Livraison rapide et produits de super qualite. Je recommande Accins !', rating: 5 },
    { name: 'Youssef A.', city: 'Rabat', text: 'Service client au top, produit conforme aux photos. Merci !', rating: 5 },
    { name: 'Imane K.', city: 'Marrakech', text: 'Premiere commande et vraiment pas decue. Livre en 48h.', rating: 5 },
  ];

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="container-custom relative py-20 md:py-28 text-center">
          
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 animate-slide-up leading-tight max-w-4xl mx-auto">
            {t('title')}
          </h1>
          <p className="text-lg md:text-2xl mb-10 opacity-90 max-w-2xl mx-auto animate-slide-up">
            {t('subtitle')}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href={`/${locale}/products`} className="inline-flex items-center gap-2 bg-white text-indigo-600 px-8 py-4 rounded-full font-display font-bold text-lg hover:bg-slate-50 hover:scale-105 transition-all shadow-2xl">
              {t('shop')} <ArrowRight size={20} />
            </Link>
            <Link href={`/${locale}/register`} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border-2 border-white/40 text-white px-8 py-4 rounded-full font-display font-bold text-lg hover:bg-white/20 transition-all">
              {t('register')}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="container-custom py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Truck, label: t('features.delivery'), sub: t('features.deliverySub') },
            { icon: ShieldCheck, label: t('features.secure'), sub: t('features.secureSub') },
            { icon: RefreshCw, label: t('features.return'), sub: t('features.returnSub') },
            { icon: Headphones, label: t('features.support'), sub: t('features.supportSub') },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <f.icon size={22} />
              </div>
              <div>
                <p className="font-display font-semibold text-sm">{f.label}</p>
                <p className="text-xs text-slate-500">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-custom py-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">{t('productsTitle')}</h2>
            <p className="text-slate-500">{t('productsSubtitle')}</p>
          </div>
          <Link href={`/${locale}/products`} className="hidden md:flex items-center gap-1 text-indigo-600 font-semibold hover:gap-2 transition-all">
            {t('seeAll')} <ArrowRight size={18} />
          </Link>
        </div>
        {products && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((p) => <ProductCard key={p.id} product={p} locale={locale} />)}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <p className="text-slate-500">{t('emptyProducts')}</p>
          </div>
        )}
      </section>

      <section className="bg-slate-900 dark:bg-slate-900 text-white">
        <div className="container-custom py-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="font-display text-4xl md:text-5xl font-bold text-indigo-400 mb-2">{Math.max(productCount || 0, 100)}+</p>
            <p className="text-sm text-slate-400">{t('stats.products')}</p>
          </div>
          <div>
            <p className="font-display text-4xl md:text-5xl font-bold text-indigo-400 mb-2">{Math.max(orderCount || 0, 500)}+</p>
            <p className="text-sm text-slate-400">{t('stats.orders')}</p>
          </div>
          <div>
            <p className="font-display text-4xl md:text-5xl font-bold text-indigo-400 mb-2">24/7</p>
            <p className="text-sm text-slate-400">{t('stats.support')}</p>
          </div>
          <div>
            <p className="font-display text-4xl md:text-5xl font-bold text-indigo-400 mb-2">100%</p>
            <p className="text-sm text-slate-400">{t('stats.satisfaction')}</p>
          </div>
        </div>
      </section>

      <section className="container-custom py-16">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">{t('testimonialsTitle')}</h2>
          <p className="text-slate-500">{t('testimonialsSubtitle')}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((tm, i) => (
            <div key={i} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 relative">
              <Quote className="absolute top-4 right-4 text-indigo-100 dark:text-indigo-950" size={40} />
              <div className="flex gap-1 mb-4">
                {Array.from({ length: tm.rating }).map((_, j) => (
                  <Star key={j} size={16} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-slate-700 dark:text-slate-300 mb-4 relative z-10">"{tm.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">{tm.name[0]}</div>
                <div>
                  <p className="font-semibold text-sm">{tm.name}</p>
                  <p className="text-xs text-slate-500">{tm.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-custom pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-900 p-10 md:p-16 text-center text-white">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '30px 30px' }} />
          <div className="relative max-w-2xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">{t('ctaTitle')}</h2>
            <p className="text-slate-300 mb-8">{t('ctaSubtitle')}</p>
            <Link href={`/${locale}/register`} className="inline-block bg-white text-slate-900 px-8 py-3.5 rounded-full font-display font-bold hover:bg-indigo-50 transition">
              {t('ctaButton')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}