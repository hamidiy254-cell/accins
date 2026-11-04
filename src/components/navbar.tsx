'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCart } from '@/store/cart';
import { useHydrated } from '@/hooks/use-hydrated';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { ShoppingCart, User, ShieldCheck, LogOut, UserCircle, Package, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const hydrated = useHydrated();
  const count = hydrated ? items.reduce((a, i) => a + i.quantity, 0) : 0;
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const loadProfile = async (uid: string) => {
      const { data } = await supabase.from('profiles').select('role').eq('id', uid).single();
      setRole(data?.role ?? null);
    };
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadProfile(data.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setRole(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false); setMobileOpen(false);
    router.push(`/${locale}`);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-[100] border-b border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950">
      <nav className="container-custom h-16 flex items-center justify-between gap-2">
        <Link href={`/${locale}`} className="flex items-center shrink-0">
          <img src="https://i.postimg.cc/xT20mRmS/888096303-5554517731440102-3460106477980446364-n.png" alt="Accins" className="h-10 md:h-12 w-auto object-contain" />
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <Link href={`/${locale}/products`} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            {t('products')}
          </Link>
        </div>

        <div className="flex items-center gap-1">
          {role === 'admin' && (
            <Link href={`/${locale}/admin`} className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm transition">
              <ShieldCheck size={16} /> Admin
            </Link>
          )}

          <Link href={`/${locale}/cart`} className="relative p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {count}
              </span>
            )}
          </Link>

          {user && (
            <div className="relative hidden md:block" ref={menuRef}>
              <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  {user.email?.[0]?.toUpperCase()}
                </div>
              </button>
              {open && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-[110]">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Connecte</p>
                    <p className="text-sm font-semibold truncate">{user.email}</p>
                  </div>
                  <div className="p-1">
                    <Link href={`/${locale}/account`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                      <UserCircle size={16} /> Mon compte
                    </Link>
                    <Link href={`/${locale}/account#orders`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                      <Package size={16} /> Mes commandes
                    </Link>
                    {role === 'admin' && (
                      <Link href={`/${locale}/admin`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition">
                        <ShieldCheck size={16} /> Admin panel
                      </Link>
                    )}
                  </div>
                  <div className="p-1 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition">
                      <LogOut size={16} /> Deconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!user && (
            <Link href={`/${locale}/login`} className="hidden md:inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition">
              {t('login')}
            </Link>
          )}

          <div className="hidden md:flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition" aria-label="Menu">
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu - SOLIDE w PRO */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[120] md:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[300px] max-w-[85vw] bg-white dark:bg-slate-950 flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <span className="font-display font-bold text-lg">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            
            {user && (
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Connecte</p>
                <p className="text-sm font-semibold truncate">{user.email}</p>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              <Link href={`/${locale}/products`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium">
                <Package size={18} className="text-indigo-600" /> {t('products')}
              </Link>
              
              {user ? (
                <>
                  <Link href={`/${locale}/account`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium">
                    <UserCircle size={18} className="text-indigo-600" /> Mon compte
                  </Link>
                  <Link href={`/${locale}/account#orders`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium">
                    <ShoppingCart size={18} className="text-indigo-600" /> Mes commandes
                  </Link>
                  {role === 'admin' && (
                    <Link href={`/${locale}/admin`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 transition font-semibold">
                      <ShieldCheck size={18} /> Admin panel
                    </Link>
                  )}
                  <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition font-medium">
                    <LogOut size={18} /> Deconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link href={`/${locale}/login`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium">
                    <User size={18} className="text-indigo-600" /> {t('login')}
                  </Link>
                  <Link href={`/${locale}/register`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium">
                    <UserCircle size={18} className="text-indigo-600" /> Inscription
                  </Link>
                </>
              )}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Langue</span>
                <LanguageSwitcher />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Thème</span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}