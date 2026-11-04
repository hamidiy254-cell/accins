'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const supabase = createClient();
  const load = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
  };
  useEffect(() => { load(); }, []);
  const del = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    await supabase.from('products').delete().eq('id', id);
    load();
  };
  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Produits</h1>
          <p className="text-sm text-slate-500 mt-1">{products.length} produit(s)</p>
        </div>
        <Link href="/fr/admin/products/new" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm transition">
          <Plus size={18} /> Ajouter
        </Link>
      </div>
      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-4 p-4 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
            {p.image_url ? (
              <img src={p.image_url} className="w-16 h-16 rounded-lg object-cover shrink-0" alt="" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs shrink-0">No img</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold truncate">{p.name}</p>
                {p.sku && (
                  <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">{p.sku}</span>
                )}
              </div>
              <p className="text-sm text-slate-500">{p.price} DH - Stock: {p.stock}</p>
            </div>
            <Link href={`/fr/admin/products/${p.id}/edit`} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition">
              <Pencil size={18} />
            </Link>
            <button onClick={() => del(p.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}