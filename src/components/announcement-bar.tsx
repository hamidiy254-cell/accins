'use client';
import { Truck, Banknote, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function AnnouncementBar() {
  const t = useTranslations('announcement');
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-sm">
      <div className="container-custom py-2 pr-10 flex items-center justify-center gap-3 md:gap-6 text-[11px] sm:text-xs md:text-sm font-medium flex-wrap">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <Truck size={14} className="shrink-0" />
          <span className="hidden sm:inline">
            {t('delivery')}
            <span className="mx-1.5 opacity-40">|</span>
            <strong className="text-yellow-300">{t('free')}</strong>
          </span>
          <span className="sm:hidden"><strong className="text-yellow-300">{t('free')}</strong></span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 whitespace-nowrap">
          <span className="opacity-40">|</span>
          <Banknote size={14} className="shrink-0" />
          <span><strong>{t('cod')}</strong></span>
        </div>
        <div className="flex md:hidden items-center gap-1 whitespace-nowrap">
          <span className="opacity-40">|</span>
          <Banknote size={12} />
          <span><strong>{t('cod')}</strong></span>
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded transition"
        aria-label={t('close')}
      >
        <X size={14} />
      </button>
    </div>
  );
}