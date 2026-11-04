'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, X } from 'lucide-react';

export function ProductForm({ product }: { product?: any }) {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    description: product?.description || '',
    price: product?.price || 0,
    old_price: product?.old_price || '',
    stock: product?.stock || 0,
    store: product?.store || '',
    image_url: product?.image_url || '',
    is_active: product?.is_active ?? true,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    e.preventDefault();
    setSaving(true); setError('');
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      description: form.description.trim() || null,
      price: Number(form.price),
      old_price: form.old_price ? Number(form.old_price) : null,
      stock: Number(form.stock),
      store: form.store.trim() || null,
      image_url: form.image_url || null,
      is_active: form.is_active,
    };
    const { error } = product
      ? await supabase.from('products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert(payload);
    setSaving(false);
    if (error) return setError(error.message);
    router.push('/fr/admin/products');
    router.refresh();
  };

  const u = (k: string, v: any) => setForm({ ...form, [k]: v });
  const inputClass = "w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition";

  return (
    <form onSubmit={save} className="space-y-5 max-w-2xl">
      <h1 className="font-display text-2xl font-bold">{product ? 'Modifier' : 'Nouveau'} produit</h1>

      <div>
        <label className="block text-sm font-medium mb-1.5">Nom du produit <span className="text-red-500">*</span></label>
        <input required value={form.name} onChange={(e) => u('name', e.target.value)} placeholder="Ex: Montre automatique..." className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          SKU / Product ID <span className="text-xs text-slate-500 font-normal">(optionnel - visible uniquement par l admin)</span>
        </label>
        <input value={form.sku} onChange={(e) => u('sku', e.target.value)} placeholder="Ex: PROD-001, ABC-42..." className={`${inputClass} font-mono`} />
        <p className="text-xs text-slate-500 mt-1">Utilise dans les commandes et l export Excel. Laisse vide pour utiliser l UUID.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Description</label>
        <textarea value={form.description} onChange={(e) => u('description', e.target.value)} rows={5} placeholder="Description detaillee du produit..." className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Prix (DH) <span className="text-red-500">*</span></label>
          <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => u('price', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Ancien prix (optionnel)</label>
          <input type="number" step="0.01" min="0" value={form.old_price || ''} onChange={(e) => u('old_price', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Stock</label>
          <input type="number" min="0" value={form.stock} onChange={(e) => u('stock', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Magasin / Store</label>
          <input value={form.store} onChange={(e) => u('store', e.target.value)} placeholder="Ex: Accins Store" className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Image</label>
        {form.image_url ? (
          <div className="relative inline-block">
            <img src={form.image_url} className="w-32 h-32 object-cover rounded-xl" alt="" />
            <button type="button" onClick={() => u('image_url', '')} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg">
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-indigo-500 transition">
            {uploading ? <Loader2 size={24} className="animate-spin text-slate-400" /> : <Upload size={24} className="text-slate-400" />}
            <span className="text-xs text-slate-500 mt-2">{uploading ? 'Upload...' : 'Upload'}</span>
            <input type="file" accept="image/*" onChange={upload} disabled={uploading} className="hidden" />
          </label>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={(e) => u('is_active', e.target.checked)} className="w-4 h-4" />
        <span className="text-sm font-medium">Produit actif (visible en boutique)</span>
      </label>

      {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">{error}</div>}

      <button disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2">
        {saving && <Loader2 size={18} className="animate-spin" />}
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  );
}