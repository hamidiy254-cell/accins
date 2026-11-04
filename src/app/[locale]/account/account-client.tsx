'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User, Save, LogOut, Package, Mail, Phone, MapPin, Home, CheckCircle } from 'lucide-react';
import { BackButton } from '@/components/back-button';

export function AccountClient({ user, profile, orders, locale }: any) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    address: profile?.address || '',
    city: profile?.city || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMessage('');
    const { error } = await supabase.from('profiles').update(form).eq('id', user.id);
    setSaving(false);
    setMessage(error ? `Erreur: ${error.message}` : 'Profil mis a jour !');
    if (!error) router.refresh();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  };

  const u = (k: string, v: string) => setForm({ ...form, [k]: v });
  const inputClass = "w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition";

  return (
    <div className="container-custom py-8 max-w-5xl">
      <BackButton href={`/${locale}`} label="Accueil" className="mb-6" />
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">Mon compte</h1>
          <p className="text-slate-500 text-sm">{user.email}</p>
        </div>
        <button onClick={signOut} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium transition">
          <LogOut size={18} /> Deconnexion
        </button>
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8">
            <h2 className="font-display text-xl font-bold mb-6 flex items-center gap-2">
              <User size={20} className="text-indigo-600" /> Informations personnelles
            </h2>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Nom complet</label>
                <input value={form.full_name} onChange={(e) => u('full_name', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5"><Phone size={14} /> Telephone</label>
                <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => u('phone', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5"><MapPin size={14} /> Adresse</label>
                <input value={form.address} onChange={(e) => u('address', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5"><Home size={14} /> Ville</label>
                <input value={form.city} onChange={(e) => u('city', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5"><Mail size={14} /> Email (lecture seule)</label>
                <input value={user.email} disabled className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-not-allowed" />
              </div>
              {message && (
                <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${message.startsWith('Erreur') ? 'bg-red-50 text-red-700 dark:bg-red-950/30' : 'bg-green-50 text-green-700 dark:bg-green-950/30'}`}>
                  {!message.startsWith('Erreur') && <CheckCircle size={16} />}
                  {message}
                </div>
              )}
              <button disabled={saving} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition">
                <Save size={18} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
        <div id="orders">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sticky top-24">
            <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
              <Package size={18} className="text-indigo-600" /> Mes commandes
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune commande pour le moment.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {orders.slice(0, 10).map((o: any) => (
                  <div key={o.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold">#{o.order_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'delivered' ? 'bg-green-100 text-green-700' : o.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{o.status}</span>
                    </div>
                    <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString('fr-FR')} - {o.total} DH</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{o.order_items?.length || 0} article(s)</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}