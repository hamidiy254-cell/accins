'use client';
import { Truck, Banknote } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function AnnouncementBar() {
  const t = useTranslations('announcement');

  return (
    <div className="relative bg-slate-900 text-white border-b border-slate-800">
      <div className="container-custom py-2.5 flex items-center justify-center">
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

        {/* Version Mobile */}
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
    </div>
  );
}