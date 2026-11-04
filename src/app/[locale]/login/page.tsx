'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/back-button';
import { Mail, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { locale } = useParams();
  const supabase = createClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push(`/${locale}`); router.refresh();
  };

  const inputClass = "w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition";

  return (
    <div className="container-custom max-w-md py-12">
      <BackButton href={`/${locale}`} label="Accueil" className="mb-6" />
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg shadow-indigo-500/30">A</div>
          <h1 className="font-display text-2xl font-bold mb-1">Bon retour !</h1>
          <p className="text-sm text-slate-500">Connecte-toi pour continuer</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" required placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mot de passe</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">{error}</div>}
          <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <p className="mt-6 text-sm text-center text-slate-500">
          Pas de compte ?{' '}
          <Link href={`/${locale}/register`} className="text-indigo-600 font-semibold hover:underline">Creer un compte</Link>
        </p>
      </div>
    </div>
  );
}