'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/back-button';
import { Mail, Lock, User, Phone, MapPin, Home, Loader2 } from 'lucide-react';

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:\s[A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', phone: '', address: '', city: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { locale } = useParams();
  const supabase = createClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!NAME_REGEX.test(form.full_name.trim())) {
      setError('Le nom ne peut contenir que des lettres et des espaces.');
      return;
    }
    setLoading(true); setError('');
    const { error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.full_name, phone: form.phone, address: form.address, city: form.city } },
    });
    setLoading(false);
    if (error) return setError(error.message);
    router.push(`/${locale}`);
  };

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });
  const inputClass = "w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition";

  return (
    <div className="container-custom max-w-md py-12">
      <BackButton href={`/${locale}`} label="Accueil" className="mb-6" />
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl">
        <div className="text-center mb-8">
          <img src="https://i.postimg.cc/xT20mRmS/888096303-5554517731440102-3460106477980446364-n.png" alt="Accins" className="h-16 w-auto mx-auto mb-4 object-contain" />
          <h1 className="font-display text-2xl font-bold mb-1">Creer un compte</h1>
          <p className="text-sm text-slate-500">Rejoins Accins en 30 secondes</p>
        </div>
        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nom complet</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required placeholder="Ahmed Alami" value={form.full_name} pattern="[A-Za-zÀ-ÖØ-öø-ÿ\s]+" title="Lettres et espaces uniquement" onChange={(e) => update('full_name', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Telephone</label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required type="tel" inputMode="tel" placeholder="06XXXXXXXX" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Adresse</label>
            <div className="relative">
              <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required placeholder="Rue, numero..." value={form.address} onChange={(e) => update('address', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Ville</label>
            <div className="relative">
              <Home size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required placeholder="Casablanca" value={form.city} onChange={(e) => update('city', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" required placeholder="vous@exemple.com" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mot de passe</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="password" required minLength={6} placeholder="Min 6 caracteres" value={form.password} onChange={(e) => update('password', e.target.value)} className={inputClass} />
            </div>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">{error}</div>}
          <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? 'Creation...' : 'Creer mon compte'}
          </button>
        </form>
        <p className="mt-6 text-sm text-center text-slate-500">
          Deja un compte ?{' '}
          <Link href={`/${locale}/login`} className="text-indigo-600 font-semibold hover:underline">Connexion</Link>
        </p>
      </div>
    </div>
  );
}