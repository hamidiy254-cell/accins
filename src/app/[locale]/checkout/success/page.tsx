'use client';
import { CheckCircle } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';

export default function SuccessPage() {
  const t = useTranslations('checkout');
  const locale = useLocale();
  return (
    <div className="container-custom max-w-md text-center py-24">
      <CheckCircle className="mx-auto text-green-500 mb-6" size={80} />
      <h1 className="font-display text-3xl font-bold mb-4">{t('thanksTitle')}</h1>
      <p className="text-gray-500 mb-8">{t('thanksSub')}</p>
      <Link href={`/${locale}/products`} className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold transition">
        {t('backToCart')}
      </Link>
    </div>
  );
}