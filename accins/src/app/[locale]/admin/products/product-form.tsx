'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function ProductForm({ product }: { product?: any }) {
  const supabase = createClient(); const router = useRouter();
  const [form, setForm] = useState({
    name: product?.name || '', description: product?.description || '',
    price: product?.price || 0, old_price: product?.old_price || '',
    stock: product?.stock || 0, store: product?.store || '',
    image_url: product?.image_url || '', is_active: product?.is_active ?? true,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('products').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('products').getPublicUrl(path);
      setForm({ ...form, image_url: data.publicUrl });
    }
    setUploading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = {
      ...form, price: Number(form.price),
      old_price: form.old_price ? Number(form.old_price) : null,
      stock: Number(form.stock),
    };
    if (product) await supabase.from('products').update(payload).eq('id', product.id);
    else await supabase.from('products').insert(payload);
    setSaving(false);
    router.push('/fr/admin/products'); router.refresh();
  };

  const u = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{product ? 'Modifier' : 'Nouveau'} produit</h1>
      <input required placeholder="Nom" value={form.name} onChange={(e) => u('name', e.target.value)}
        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
      <textarea placeholder="Description" value={form.description}
        onChange={(e) => u('description', e.target.value)} rows={4}
        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
      <div className="grid grid-cols-2 gap-4">
        <input required type="number" step="0.01" placeholder="Prix" value={form.price}
          onChange={(e) => u('price', e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input type="number" step="0.01" placeholder="Ancien prix" value={form.old_price || ''}
          onChange={(e) => u('old_price', e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input type="number" placeholder="Stock" value={form.stock}
          onChange={(e) => u('stock', e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
        <input placeholder="Store" value={form.store}
          onChange={(e) => u('store', e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700" />
      </div>
      <div>
        <label className="block text-sm mb-2">Image</label>
        <input type="file" accept="image/*" onChange={upload} disabled={uploading} />
        {form.image_url && <img src={form.image_url} className="mt-2 w-32 h-32 object-cover rounded" alt="" />}
        {uploading && <p className="text-sm text-gray-500 mt-1">Upload...</p>}
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.is_active} onChange={(e) => u('is_active', e.target.checked)} />
        Actif
      </label>
      <button disabled={saving}
        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
        {saving ? '...' : 'Enregistrer'}
      </button>
    </form>
  );
}