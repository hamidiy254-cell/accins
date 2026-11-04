'use client';
import { Truck, Banknote, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function AnnouncementBar() {
  const t = useTranslations('announcement');
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="relative bg-slate-900 text-white border-b border-slate-800">
      <div className="container-custom py-2.5 pr-10 flex items-center justify-center">
        
        {/* Version Desktop */}
        <div className="hidden md:flex items-center gap-6 text-xs md:text-sm font-medium">
          <div className="flex items-center gap-2">
            <Truck size={15} className="text-indigo-400" />
            <span>{t('delivery')} <span className="text-slate-500 mx-1">|</span> <strong className="text-green-400">{t('free')}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Banknote size={15} className="text-indigo-400" />
            <span><strong>{t('cod')}</strong></span>
          </div>
        </div>

        {/* Version Mobile (Propre sur 2 lignes) */}
        <div className="flex md:hidden flex-col items-center justify-center text-[11px] sm:text-xs gap-1 font-medium">
          <div className="flex items-center gap-1.5">
            <Truck size={13} className="text-indigo-400" />
            <span>{t('delivery')} <span className="text-slate-500 mx-0.5">|</span> <strong className="text-green-400">{t('free')}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Banknote size={13} className="text-indigo-400" />
            <span><strong>{t('cod')}</strong></span>
          </div>
        </div>

      </div>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg transition"
        aria-label={t('close')}
      >
        <X size={16} />
      </button>
    </div>
  );
}