import Link from 'next/link';
import { Package, ShoppingBag, Ticket, LayoutDashboard } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex gap-6 flex-col md:flex-row">
        <aside className="md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-2">
            <AdminLink href="" icon={<LayoutDashboard size={18} />} label="Dashboard" />
            <AdminLink href="/products" icon={<Package size={18} />} label="Produits" />
            <AdminLink href="/orders" icon={<ShoppingBag size={18} />} label="Commandes" />
            <AdminLink href="/coupons" icon={<Ticket size={18} />} label="Coupons" />
          </nav>
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

function AdminLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={`/fr/admin${href}`}
      className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
      {icon}{label}
    </Link>
  );
}