'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Loader2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Composant séparé pour chaque produit (nécessaire pour Dnd-Kit)
function SortableProduct({ product, onDelete }: { product: any, onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 md:gap-3 p-3 md:p-4 border rounded-xl bg-white dark:bg-slate-900 transition ${
        isDragging 
          ? 'border-indigo-500 shadow-2xl ring-2 ring-indigo-500/20 cursor-grabbing' 
          : 'dark:border-slate-800 border-slate-200 hover:shadow-md'
      }`}
    >
      {/* Bouton Drag (poignée) */}
      <button
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }} // Obligatoire pour mobile
        className="p-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition"
        title="Glisser pour réordonner"
      >
        <GripVertical size={20} />
      </button>

      {/* Image */}
      {product.image_url ? (
        <img src={product.images?.[0] || product.image_url} className="w-14 h-14 md:w-16 md:h-16 rounded-lg object-cover shrink-0 border border-slate-100 dark:border-slate-800 pointer-events-none" alt="" />
      ) : (
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-[10px] shrink-0 pointer-events-none">No img</div>
      )}

      {/* Infos */}
      <div className="flex-1 min-w-0 pointer-events-none">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold truncate text-sm md:text-base">{product.name}</p>
          {product.sku && <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">{product.sku}</span>}
          {!product.is_active && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">Inactif</span>}
        </div>
        <p className="text-xs md:text-sm text-slate-500 mt-1">{product.price} DH — Stock: {product.stock}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Link href={`/fr/admin/products/${product.id}/edit`} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition">
          <Pencil size={18} />
        </Link>
        <button onClick={() => onDelete(product.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
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

  // Sensors: souris + tactile + clavier
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { distance: 5 } // Évite de déclencher un drag en cliquant sur autre chose
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);

    // Reordonner localement (optimistic update)
    const newProducts = arrayMove(products, oldIndex, newIndex);
    setProducts(newProducts);
    setIsSaving(true);

    // Enregistrer les nouveaux ordres dans Supabase
    const promises = newProducts.map((p, index) => 
      supabase.from('products').update({ sort_order: index }).eq('id', p.id)
    );

    await Promise.all(promises);
    setIsSaving(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            Produits
            {isSaving && <span className="text-xs font-normal text-slate-500 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg"><Loader2 size={12} className="animate-spin" /> Enregistrement...</span>}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{products.length} produit(s) — Glissez-déposez pour réordonner</p>
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
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} 
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={products.map(p => p.id)} 
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {products.map((p) => (
                <SortableProduct key={p.id} product={p} onDelete={del} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}