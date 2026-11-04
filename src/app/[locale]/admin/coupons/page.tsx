'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trash2, Plus, Package } from 'lucide-react';

export default function CouponsPage() {
  const supabase = createClient();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState({ code: '', discount_type: 'percent', discount_value: 10, max_uses: '' });
  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(data || []);
  };

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('id, name').eq('is_active', true).order('name');
    setProducts(data || []);
  };

  useEffect(() => { load(); loadProducts(); }, []);

  const reset = () => {
    setForm({ code: '', discount_type: 'percent', discount_value: 10, max_uses: '' });
    setApplyToAll(true);
    setSelectedIds([]);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyToAll && selectedIds.length === 0) {
      alert('Selectionne au moins 1 produit ou coche "Tous les produits"');
      return;
    }
    const { error } = await supabase.from('coupons').insert({
      code: form.code.toUpperCase().trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      product_ids: applyToAll ? null : selectedIds,
    });
    if (error) { alert(error.message); return; }
    reset();
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Supprimer ce coupon ?')) return;
    await supabase.from('coupons').delete().eq('id', id);
    load();
  };

  const toggleProduct = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const inputClass = "px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 focus:border-indigo-500 outline-none transition text-sm";

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Coupons</h1>

      <form onSubmit={add} className="mb-8 p-5 border dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input required placeholder="Code (ex: PROMO10)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={`${inputClass} font-mono`} />
          <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className={inputClass}>
            <option value="percent">Pourcentage (%)</option>
            <option value="fixed">Montant fixe (DH)</option>
          </select>
          <input required type="number" step="0.01" min="0" placeholder="Valeur" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value as any })} className={inputClass} />
          <input type="number" min="0" placeholder="Max utilisations" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className={inputClass} />
        </div>

        <div className="border-t dark:border-slate-700 pt-4">
          <p className="text-sm font-medium mb-3 flex items-center gap-2"><Package size={16} /> Produits eligibles</p>
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm">Tous les produits</span>
          </label>
          {!applyToAll && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border border-slate-200 dark:border-slate-700 rounded-xl">
              {products.length === 0 ? (
                <p className="text-sm text-slate-500 col-span-2">Aucun produit actif.</p>
              ) : products.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="w-4 h-4" />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          )}
          {!applyToAll && selectedIds.length > 0 && (
            <p className="text-xs text-indigo-600 mt-2 font-medium">{selectedIds.length} produit(s) selectionne(s)</p>
          )}
        </div>

        <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
          <Plus size={18} /> Creer le coupon
        </button>
      </form>

      <div className="space-y-2">
        {coupons.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">Aucun coupon cree.</div>
        ) : coupons.map((c) => (
          <div key={c.id} className="flex justify-between items-center p-4 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-indigo-600">{c.code}</span>
                <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 rounded-full font-medium">
                  {c.discount_type === 'percent' ? `-${c.discount_value}%` : `-${c.discount_value} DH`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {c.product_ids && c.product_ids.length > 0 ? `${c.product_ids.length} produit(s) specifique(s)` : 'Tous les produits'}
                {c.max_uses && ` - max ${c.max_uses} utilisations`}
                {c.used_count > 0 && ` - ${c.used_count} utilise(s)`}
              </p>
            </div>
            <button onClick={() => del(c.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition shrink-0">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}