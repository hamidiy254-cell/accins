'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, X, Globe, Sparkles } from 'lucide-react';
import { translateProduct } from '@/app/actions/translate';

export function ProductForm({ product }: { product?: any }) {
  const supabase = createClient();
  const router = useRouter();
  
  const initialImages = product?.images?.length > 0 
    ? product.images 
    : (product?.image_url ? [product.image_url] : []);

  const [form, setForm] = useState({
    name: product?.name || '',
    name_en: product?.name_en || '',
    name_ar: product?.name_ar || '',
    description: product?.description || '',
    description_en: product?.description_en || '',
    description_ar: product?.description_ar || '',
    sku: product?.sku || '',
    price: product?.price || 0,
    old_price: product?.old_price || '',
    stock: product?.stock || 0,
    store: product?.store || '',
    sort_order: product?.sort_order || 0,
    images: initialImages as string[],
    is_active: product?.is_active ?? true,
  });
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');

  const uploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const newImages = [...form.images];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = `${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
      const { error } = await supabase.storage.from('products').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('products').getPublicUrl(path);
        newImages.push(data.publicUrl);
      }
    }
    setForm({ ...form, images: newImages });
    setUploading(false);
  };

  const removeImage = (index: number) => {
    setForm({ ...form, images: form.images.filter((_, i) => i !== index) });
  };

  const handleAutoTranslate = async () => {
    if (!form.name.trim() && !form.description.trim()) {
      alert("Veuillez d'abord remplir le nom ou la description en français.");
      return;
    }
    
    setTranslating(true);
    try {
      // Traduction en Anglais
      const [nameEn, descEn] = await Promise.all([
        form.name.trim() ? translateProduct(form.name, 'en') : Promise.resolve(''),
        form.description.trim() ? translateProduct(form.description, 'en') : Promise.resolve(''),
      ]);
      
      // Traduction en Arabe
      const [nameAr, descAr] = await Promise.all([
        form.name.trim() ? translateProduct(form.name, 'ar') : Promise.resolve(''),
        form.description.trim() ? translateProduct(form.description, 'ar') : Promise.resolve(''),
      ]);

      setForm(prev => ({
        ...prev,
        name_en: nameEn,
        description_en: descEn,
        name_ar: nameAr,
        description_ar: descAr,
      }));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la traduction. Vérifiez votre connexion et réessayez.");
    } finally {
      setTranslating(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    
    const payload = {
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      name_ar: form.name_ar.trim() || null,
      description: form.description.trim() || null,
      description_en: form.description_en.trim() || null,
      description_ar: form.description_ar.trim() || null,
      sku: form.sku.trim() || null,
      price: Number(form.price),
      old_price: form.old_price ? Number(form.old_price) : null,
      stock: Number(form.stock),
      store: form.store.trim() || null,
      sort_order: Number(form.sort_order),
      images: form.images,
      image_url: form.images[0] || null,
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
    <form onSubmit={save} className="space-y-6 max-w-3xl">
      <h1 className="font-display text-2xl font-bold">{product ? 'Modifier' : 'Nouveau'} produit</h1>

      {/* Infos de base */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">SKU (Optionnel)</label>
          <input value={form.sku} onChange={(e) => u('sku', e.target.value)} placeholder="Ex: PROD-001" className={`${inputClass} font-mono`} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Ordre d'affichage (Plus petit = en premier)</label>
          <input type="number" value={form.sort_order} onChange={(e) => u('sort_order', e.target.value)} placeholder="Ex: 0, 1, 2..." className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Prix (DH) <span className="text-red-500">*</span></label>
          <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => u('price', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Ancien prix</label>
          <input type="number" step="0.01" min="0" value={form.old_price || ''} onChange={(e) => u('old_price', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Stock</label>
          <input type="number" min="0" value={form.stock} onChange={(e) => u('stock', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Magasin</label>
          <input value={form.store} onChange={(e) => u('store', e.target.value)} placeholder="Ex: Accins" className={inputClass} />
        </div>
      </div>

      {/* Traductions */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-slate-50 dark:bg-slate-900/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Globe size={18} /> Traductions (Optionnel)
          </h3>
          <button
            type="button"
            onClick={handleAutoTranslate}
            disabled={translating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50 shadow-sm"
          >
            {translating ? (
              <><Loader2 size={16} className="animate-spin" /> Traduction en cours...</>
            ) : (
              <><Sparkles size={16} /> Traduire automatiquement</>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Remplissez d'abord le nom et la description en français, puis cliquez sur "Traduire automatiquement" pour générer les versions anglaise et arabe.
        </p>
        
        {/* FR */}
        <div className="grid grid-cols-1 gap-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">FR</span> 
            <span className="text-sm font-medium">Français (Par défaut)</span>
          </div>
          <input required value={form.name} onChange={(e) => u('name', e.target.value)} placeholder="Nom du produit en français" className={inputClass} />
          <textarea value={form.description} onChange={(e) => u('description', e.target.value)} placeholder="Description en français" rows={3} className={inputClass} />
        </div>

        {/* EN */}
        <div className="grid grid-cols-1 gap-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">EN</span> 
            <span className="text-sm font-medium">English</span>
          </div>
          <input value={form.name_en} onChange={(e) => u('name_en', e.target.value)} placeholder="Product name in English" className={inputClass} />
          <textarea value={form.description_en} onChange={(e) => u('description_en', e.target.value)} placeholder="Description in English" rows={3} className={inputClass} />
        </div>

        {/* AR */}
        <div className="grid grid-cols-1 gap-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" dir="rtl">
          <div className="flex items-center gap-2 mb-1 justify-end">
            <span className="text-sm font-medium">العربية</span> 
            <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">AR</span>
          </div>
          <input value={form.name_ar} onChange={(e) => u('name_ar', e.target.value)} placeholder="اسم المنتج بالعربية" className={inputClass} />
          <textarea value={form.description_ar} onChange={(e) => u('description_ar', e.target.value)} placeholder="وصف بالعربية" rows={3} className={inputClass} />
        </div>
      </div>

      {/* Images */}
      <div>
        <label className="block text-sm font-medium mb-2">Images du produit (Maximum 5 recommandé)</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {form.images.map((img, idx) => (
            <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <img src={img} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
              {idx === 0 && (
                <div className="absolute top-1 left-1 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                  Principale
                </div>
              )}
              <button 
                type="button" 
                onClick={() => removeImage(idx)} 
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition shadow-lg"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition">
            {uploading ? (
              <Loader2 size={24} className="animate-spin text-indigo-500" />
            ) : (
              <>
                <Upload size={24} className="text-slate-400 mb-2" />
                <span className="text-xs text-slate-500 font-medium text-center px-2">Ajouter<br/>images</span>
              </>
            )}
            <input type="file" accept="image/*" multiple onChange={uploadImages} disabled={uploading} className="hidden" />
          </label>
        </div>
        <p className="text-xs text-slate-500">La première image sera utilisée dans la boutique.</p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
        <input type="checkbox" checked={form.is_active} onChange={(e) => u('is_active', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
        <span className="text-sm font-medium">Produit actif (visible en boutique)</span>
      </label>

      {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">{error}</div>}

      <button 
        disabled={saving} 
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
      >
        {saving ? <><Loader2 size={18} className="animate-spin" /> Enregistrement...</> : 'Enregistrer le produit'}
      </button>
    </form>
  );
}