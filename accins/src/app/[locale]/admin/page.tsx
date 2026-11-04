import { createClient } from '@/lib/supabase/server';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const [p, o, c] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('coupons').select('*', { count: 'exact', head: true }),
  ]);
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Stat label="Produits" value={p.count || 0} />
        <Stat label="Commandes" value={o.count || 0} />
        <Stat label="Coupons" value={c.count || 0} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-6 border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-4xl font-bold text-indigo-600 mt-2">{value}</p>
    </div>
  );
}