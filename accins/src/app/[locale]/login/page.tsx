'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const router = useRouter(); const { locale } = useParams();
  const supabase = createClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push(`/${locale}`); router.refresh();
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 border dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900">
      <h1 className="text-2xl font-bold mb-6">Connexion</h1>
      <form onSubmit={submit} className="space-y-4">
        <input type="email" placeholder="Email" value={email} required
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input type="password" placeholder="Mot de passe" value={password} required
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? '...' : 'Se connecter'}
        </button>
      </form>
      <p className="mt-4 text-sm text-center">
        Pas de compte ? <Link href={`/${locale}/register`} className="text-indigo-600">S\'inscrire</Link>
      </p>
    </div>
  );
}