'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MessageCircle, Lock, ArrowLeft, Users, ShieldCheck, Loader2 } from 'lucide-react';
import { GeneralChat } from './general-chat';
import { PrivateChat } from './private-chat';

export default function ChatPage() {
  const t = useTranslations('chat');
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<'general' | 'private'>('general');
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(`/${locale}/login`); return; }
      setUser(user);
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setRole(data?.role ?? null);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-fuchsia-600" size={32} />
      </div>
    );
  }

  return (
    <div className="container-custom py-6 md:py-8 max-w-4xl">
      <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-fuchsia-600 mb-4 transition">
        <ArrowLeft size={16} /> {t('back')}
      </Link>

      <div className="mb-4">
        <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2">
          <MessageCircle className="text-fuchsia-500" size={28} /> {t('title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('general')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            tab === 'general' ? 'bg-white dark:bg-slate-800 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users size={16} /> {t('tabGeneral')}
        </button>
        <button
          onClick={() => setTab('private')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            tab === 'private' ? 'bg-white dark:bg-slate-800 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {role === 'admin' ? <ShieldCheck size={16} /> : <Lock size={16} />}
          {role === 'admin' ? t('tabAdmin') : t('tabSupport')}
        </button>
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        {tab === 'general' ? (
          <GeneralChat user={user} />
        ) : (
          <PrivateChat user={user} isAdmin={role === 'admin'} />
        )}
      </div>
    </div>
  );
}