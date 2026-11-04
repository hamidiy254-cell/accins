'use client';
import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Download, Phone, Trash2 } from 'lucide-react';
import { exportOrdersToExcel, type ExportRow } from '@/lib/excel-export';

type Filter = 'all' | 'today' | 'yesterday' | 'week' | 'month';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'today', label: "Aujourd hui" },
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

type Row = {
  orderId: string;
  productId: string;
  quantity: number;
  customer: string;
  phone: string;
  address: string;
  city: string;
  price: number;
  store: string;
  note: string;
  orderNumber: number;
  status: string;
  createdAt: string;
};

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

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    orders.forEach((o) => {
      const items = o.order_items || [];
      const deliveryFee = Number(o.delivery_fee || 0);

      if (items.length === 0) {
        out.push({
          orderId: o.id, productId: '—', quantity: 0,
          customer: o.customer_name, phone: o.phone, address: o.address, city: o.city,
          price: Number(o.subtotal || 0) + deliveryFee,
          store: o.store || '', note: o.note || '',
          orderNumber: o.order_number, status: o.status, createdAt: o.created_at,
        });
      } else {
        items.forEach((it: any, idx: number) => {
          let rowPrice = Number(it.unit_price) * it.quantity;
          // Delivery fee ajoute a la premiere ligne uniquement
          if (idx === 0 && deliveryFee > 0) rowPrice += deliveryFee;

          out.push({
            orderId: o.id,
            productId: it.product_sku || it.product_id?.slice(0, 8) || '—',
            quantity: it.quantity, customer: o.customer_name,
            phone: o.phone, address: o.address, city: o.city,
            price: rowPrice,
            store: it.store || o.store || '', note: o.note || '',
            orderNumber: o.order_number, status: o.status, createdAt: o.created_at,
          });
        });
      }
    });
    return out;
  }, [orders]);

  const exportRows: ExportRow[] = rows.map((r) => ({
    'Product ID': r.productId,
    'Quantity': r.quantity,
    'Customer': r.customer,
    'Phone': r.phone,
    'Adresse': r.address,
    'City': r.city,
    'Price': r.price,
    'Store': r.store,
    'Note': r.note,
    'Order': `#${r.orderNumber}`,
  }));

  const handleExport = () => exportOrdersToExcel(exportRows, `orders-${filter}-${Date.now()}.xlsx`);

  const deleteOrder = async (orderId: string, orderNumber: number) => {
    if (!confirm(`Supprimer la commande #${orderNumber} ? Cette action est irreversible.`)) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      alert(`Erreur: ${error.message}\n\nVerifie la politique RLS de suppression.`);
      return;
    }
    load(filter);
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Commandes</h1>
          <p className="text-sm text-slate-500 mt-1">{rows.length} ligne(s) - {orders.length} commande(s)</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm transition">
          <Download size={18} /> Excel
        </button>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${filter === f.key ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
            {f.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-center py-16 text-slate-500">Chargement...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">
          Aucune commande pour cette periode.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Product ID</th>
                  <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Quantity</th>
                  <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Customer</th>
                  <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Phone</th>
                  <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Adresse</th>
                  <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">City</th>
                  <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Price</th>
                  <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Store</th>
                  <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Note</th>
                  <th className="p-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Order</th>
                  <th className="p-3 text-center font-semibold text-slate-700 dark:text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="p-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{r.productId}</td>
                    <td className="p-3 font-semibold">{r.quantity}</td>
                    <td className="p-3 font-medium whitespace-nowrap">{r.customer}</td>
                    <td className="p-3">
                      <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-indigo-600 hover:underline"><Phone size={12} /> {r.phone}</a>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={r.address}>{r.address}</td>
                    <td className="p-3 whitespace-nowrap">{r.city}</td>
                    <td className="p-3 font-bold text-indigo-600 whitespace-nowrap">{r.price.toFixed(2)} DH</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{r.store || '—'}</td>
                    <td className="p-3 text-slate-500 text-xs max-w-[150px] truncate" title={r.note}>{r.note || '—'}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold">#{r.orderNumber}</span>
                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${r.status === 'delivered' ? 'bg-green-100 text-green-700' : r.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => deleteOrder(r.orderId, r.orderNumber)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition" title="Supprimer la commande"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}