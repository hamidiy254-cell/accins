'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trash2, Plus } from 'lucide-react';

export default function CouponsPage() {
  const supabase = createClient();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [form, setForm] = useState({ code: '', discount_type: 'percent', discount_value: 10, max_uses: '', expires_at: '' });

  const load = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('coupons').insert({
      ...form, code: form.code.toUpperCase(),
      discount_value: Number(form.discount_value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
    });
    setForm({ code: '', discount_type: 'percent', discount_value: 10, max_uses: '', expires_at: '' });
    load();
  };

  const del = async (id: string) => {
    await supabase.from('coupons').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Coupons</h1>
      <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-8 p-4 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
        <input required placeholder="Code" value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <select value={form.discount_type}
          onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
          className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700">
          <option value="percent">%</option>
          <option value="fixed">DH</option>
        </select>
        <input type="number" required placeholder="Valeur" value={form.discount_value}
          onChange={(e) => setForm({ ...form, discount_value: e.target.value as any })}
          className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input type="number" placeholder="Max uses" value={form.max_uses}
          onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
          className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <button className="bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-1">
          <Plus size={16} /> Ajouter
        </button>
      </form>
      <div className="space-y-2">
        {coupons.map((c) => (
          <div key={c.id} className="flex justify-between items-center p-3 border dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
            <div>
              <span className="font-mono font-bold">{c.code}</span>
              <span className="ml-3 text-sm text-gray-500">
                {c.discount_type === 'percent' ? `-${c.discount_value}%` : `-${c.discount_value} DH`}
                {c.max_uses && ` • max ${c.max_uses}`}
              </span>
            </div>
            <button onClick={() => del(c.id)} className="text-red-500"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}