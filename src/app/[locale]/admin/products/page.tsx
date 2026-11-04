'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortingId, setSortingId] = useState<string | null>(null);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    // Tri principal : sort_order (croissant). Secondaire : date (recent en premier)
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    await supabase.from('products').delete().eq('id', id);
    load();
  };

  // Fonction bach n7arko l'produit (lfo9 wla lte7t)
  const moveProduct = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === products.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newProducts = [...products];

    // Swap f l'array local
    [newProducts[index], newProducts[targetIndex]] = [newProducts[targetIndex], newProducts[index]];

    // On donne des nouveaux numéros d'ordre (0, 1, 2, 3...) bach yb9a kolchi mzyan
    const updated = newProducts.map((p, i) => ({ ...p, sort_order: i }));
    setProducts(updated);
    setSortingId(products[index].id);

    // Update f Supabase
    const promises = updated.map((p, i) => 
      supabase.from('products').update({ sort_order: i }).eq('id', p.id)
    );

    await Promise.all(promises);
    setSortingId(null);
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

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">
          Aucun produit. Cliquez sur "Ajouter" pour commencer.
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p, index) => (
            <div key={p.id} className="flex items-center gap-3 p-3 md:p-4 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 hover:shadow-md transition">
              
              {/* Boutons d'ordre (↑ ↓) */}
              <div className="flex flex-col gap-1 shrink-0">
                <button 
                  onClick={() => moveProduct(index, 'up')}
                  disabled={index === 0 || sortingId === p.id}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 disabled:opacity-30 transition"
                  title="Monter"
                >
                  <ArrowUp size={14} />
                </button>
                <button 
                  onClick={() => moveProduct(index, 'down')}
                  disabled={index === products.length - 1 || sortingId === p.id}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 disabled:opacity-30 transition"
                  title="Descendre"
                >
                  <ArrowDown size={14} />
                </button>
              </div>

              {/* Image */}
              {p.image_url ? (
                <img src={p.images?.[0] || p.image_url} className="w-14 h-14 md:w-16 md:h-16 rounded-lg object-cover shrink-0 border border-slate-100 dark:border-slate-800" alt="" />
              ) : (
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-[10px] shrink-0">No img</div>
              )}

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate text-sm md:text-base">{p.name}</p>
                  {p.sku && <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">{p.sku}</span>}
                  {!p.is_active && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">Inactif</span>}
                </div>
                <p className="text-xs md:text-sm text-slate-500 mt-1">{p.price} DH — Stock: {p.stock}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Link href={`/fr/admin/products/${p.id}/edit`} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition">
                  <Pencil size={18} />
                </Link>
                <button onClick={() => del(p.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}