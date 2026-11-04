'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';

const locales = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇲🇦' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const change = (newLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
        <Globe size={20} />
      </button>
      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px]">
        {locales.map((l) => (
          <button key={l.code} onClick={() => change(l.code)}
            className={`block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 ${locale === l.code ? 'font-bold' : ''}`}>
            {l.flag} {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}