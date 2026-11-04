import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { AddToCartButton } from './add-to-cart-button';

export default async function ProductPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from('products').select('*').eq('id', id).single();
  if (!product) notFound();
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-12">
      <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden">
        {product.image_url && <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />}
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
        <p className="text-2xl text-indigo-600 font-bold mb-6">{product.price} DH</p>
        <p className="text-gray-600 dark:text-gray-300 mb-8">{product.description}</p>
        <AddToCartButton product={product} />
      </div>
    </div>
  );
}