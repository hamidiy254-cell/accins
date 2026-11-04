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
    if (!confirm('Supprimer ?')) return;
    await supabase.from('products').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Produits</h1>
        <Link href="/fr/admin/products/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg">
          <Plus size={18} /> Ajouter
        </Link>
      </div>
      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-4 p-4 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
            {p.image_url && <img src={p.image_url} className="w-16 h-16 rounded object-cover" alt="" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{p.name}</p>
              <p className="text-sm text-gray-500">{p.price} DH • Stock: {p.stock}</p>
            </div>
            <Link href={`/fr/admin/products/${p.id}/edit`}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
              <Pencil size={18} />
            </Link>
            <button onClick={() => del(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}