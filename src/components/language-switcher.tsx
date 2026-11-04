'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Globe, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const locales = [
  { code: 'fr', label: 'Français', flag: 'FR' },
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'ar', label: 'العربية', flag: 'AR' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const change = (newLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    const newPath = segments.join('/');
    
    // Hard reload bach n-damno bli les selects/options maytkhebawoch
    window.location.href = newPath; 
  };

  const currentLang = locales.find(l => l.code === locale);

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-sm font-medium"
      >
        <Globe size={18} />
        <span className="hidden sm:inline">{currentLang?.flag}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-[100] min-w-[150px]">
          {locales.map((l) => (
            <button 
              key={l.code} 
              onClick={() => change(l.code)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left ${locale === l.code ? 'font-bold text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20' : ''}`}
            >
              <span className="text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">{l.flag}</span> 
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}