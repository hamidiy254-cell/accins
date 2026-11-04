'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCart } from '@/store/cart';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { ShoppingCart, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const items = useCart((s) => s.items);
  const count = items.reduce((a, i) => a + i.quantity, 0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) =>
      setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b dark:border-gray-800">
      <nav className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={`/${locale}`} className="text-2xl font-bold text-indigo-600">Accins</Link>
        <div className="flex items-center gap-2">
          <Link href={`/${locale}/products`} className="hidden md:block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            {t('products')}
          </Link>
          <Link href={`/${locale}/cart`} className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <Link href={`/${locale}/account`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <User size={20} />
            </Link>
          ) : (
            <Link href={`/${locale}/login`} className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm">
              {t('login')}
            </Link>
          )}
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}