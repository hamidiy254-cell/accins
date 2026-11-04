'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', phone: '', address: '', city: '', email: '', password: '' });
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const router = useRouter(); const { locale } = useParams();
  const supabase = createClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    const { error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.full_name, phone: form.phone, address: form.address, city: form.city } },
    });
    setLoading(false);
    if (error) return setError(error.message);
    router.push(`/${locale}`);
  };

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="max-w-md mx-auto mt-12 p-8 border dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900">
      <h1 className="text-2xl font-bold mb-6">Créer un compte</h1>
      <form onSubmit={submit} className="space-y-4">
        <input placeholder="Nom complet" required value={form.full_name}
          onChange={(e) => update('full_name', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input placeholder="Téléphone" required value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input placeholder="Adresse" required value={form.address}
          onChange={(e) => update('address', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input placeholder="Ville" required value={form.city}
          onChange={(e) => update('city', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input type="email" placeholder="Email" required value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input type="password" placeholder="Mot de passe (min 6)" required minLength={6} value={form.password}
          onChange={(e) => update('password', e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded-lg disabled:opacity-50">
          {loading ? '...' : 'S\'inscrire'}
        </button>
      </form>
      <p className="mt-4 text-sm text-center">
        Déjà un compte ? <Link href={`/${locale}/login`} className="text-indigo-600">Connexion</Link>
      </p>
    </div>
  );
}