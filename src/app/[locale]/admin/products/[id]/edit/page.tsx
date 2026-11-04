import { createClient } from '@/lib/supabase/server';
import { ProductForm } from '../../product-form';

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('products').select('*').eq('id', id).single();
  return <ProductForm product={data} />;
}