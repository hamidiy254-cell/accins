'use client';
import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Download } from 'lucide-react';
import { exportOrdersToExcel, type ExportRow } from '@/lib/excel-export';

type Filter = 'all' | 'today' | 'yesterday' | 'week' | 'month';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: 'week', label: '7 derniers jours' },
  { key: 'month', label: 'Ce mois' },
];

function getRange(f: Filter): { from?: Date; to?: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  switch (f) {
    case 'today': return { from: today, to: tomorrow };
    case 'yesterday': { const y = new Date(today); y.setDate(today.getDate() - 1); return { from: y, to: today }; }
    case 'week': { const w = new Date(today); w.setDate(today.getDate() - 7); return { from: w, to: tomorrow }; }
    case 'month': { const m = new Date(now.getFullYear(), now.getMonth(), 1); return { from: m, to: tomorrow }; }
    default: return {};
  }
}

export default function OrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);

  const load = async (f: Filter) => {
    setLoading(true);
    let q = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
    const { from, to } = getRange(f);
    if (from) q = q.gte('created_at', from.toISOString());
    if (to) q = q.lt('created_at', to.toISOString());
    const { data } = await q;
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => { load(filter); }, [filter]);

  const exportRows: ExportRow[] = useMemo(() => {
    const rows: ExportRow[] = [];
    orders.forEach((o) => {
      const items = o.order_items || [];
      if (items.length === 0) {
        rows.push({
          'Product ID': '—', 'Quantity': 0, 'Customer': o.customer_name,
          'Phone': o.phone, 'Adresse': o.address, 'City': o.city,
          'Price': Number(o.total), 'Store': o.store || '',
          'Note': o.note || '', 'Order': `#${o.order_number}`,
        });
      } else {
        items.forEach((it: any) => {
          rows.push({
            'Product ID': it.product_id?.slice(0, 8) || '—',
            'Quantity': it.quantity, 'Customer': o.customer_name,
            'Phone': o.phone, 'Adresse': o.address, 'City': o.city,
            'Price': Number(it.unit_price) * it.quantity,
            'Store': it.store || o.store || '', 'Note': o.note || '',
            'Order': `#${o.order_number}`,
          });
        });
      }
    });
    return rows;
  }, [orders]);

  const handleExport = () => {
    exportOrdersToExcel(exportRows, `orders-${filter}-${Date.now()}.xlsx`);
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Commandes</h1>
        <button onClick={handleExport}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
          <Download size={18} /> Télécharger Excel
        </button>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg border ${filter === f.key
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 dark:border-gray-700'}`}>
            {f.label}
          </button>
        ))}
      </div>
      {loading ? <p>Chargement...</p> : (
        <div className="overflow-x-auto border dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left">Order</th>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">City</th>
                <th className="p-3 text-left">Total</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {exportRows.map((r, i) => {
                const o = orders.find((x) => `#${x.order_number}` === r['Order']);
                return (
                  <tr key={i} className="border-t dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-3 font-mono">{r['Order']}</td>
                    <td className="p-3">{r['Customer']}</td>
                    <td className="p-3">{r['Phone']}</td>
                    <td className="p-3">{r['City']}</td>
                    <td className="p-3 font-semibold text-indigo-600">{r['Price']} DH</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        o?.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        o?.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'}`}>{o?.status}</span>
                    </td>
                    <td className="p-3 text-gray-500">
                      {o && new Date(o.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}