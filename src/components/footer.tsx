'use client';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useState } from 'react';
import { MessageSquare, Truck, Banknote } from 'lucide-react';
import { ContactModal } from './contact-modal';

export function Footer() {
  const t = useTranslations('footer');
  const locale = useLocale();
  const [openContact, setOpenContact] = useState(false);

  return (
    <>
      <footer className="mt-20 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="container-custom py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href={/} className="flex items-center mb-4">
              <img src="https://i.postimg.cc/xT20mRmS/888096303-5554517731440102-3460106477980446364-n.png" alt="Accins" className="h-10 w-auto object-contain" />
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{t('tagline')}</p>
            <div className="flex flex-col gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Truck size={12} /> {t('deliveryNote')}</span>
              <span className="flex items-center gap-1.5"><Banknote size={12} /> {t('codNote')}</span>
            </div>
          </div>
          <div>
            <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider">{t('shop')}</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li><Link href={`/${locale}/products`} className="hover:text-indigo-600 transition">{t('allProducts')}</Link></li>
              <li><Link href={`/${locale}/cart`} className="hover:text-indigo-600 transition">{t('cart')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider">{t('account')}</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li><Link href={`/${locale}/login`} className="hover:text-indigo-600 transition">{t('login')}</Link></li>
              <li><Link href={`/${locale}/register`} className="hover:text-indigo-600 transition">{t('register')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider">{t('contact')}</h4>
            <button
              onClick={() => setOpenContact(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition w-full sm:w-auto justify-center"
            >
              <MessageSquare size={16} /> {t('contactUs')}
            </button>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">{t('contactUsSub')}</p>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Accins — {t('rights')}
        </div>
      </footer>

      <ContactModal open={openContact} onClose={() => setOpenContact(false)} />
    </>
  );
}