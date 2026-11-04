import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  id: string; name: string; price: number; image_url?: string;
  quantity: number; store?: string;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  remove: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  total: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item, qty = 1) => set((s) => {
        const existing = s.items.find((i) => i.id === item.id);
        if (existing) return {
          items: s.items.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + qty } : i),
        };
        return { items: [...s.items, { ...item, quantity: qty }] };
      }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      updateQty: (id, qty) => set((s) => ({
        items: qty <= 0
          ? s.items.filter((i) => i.id !== id)
          : s.items.map((i) => i.id === id ? { ...i, quantity: qty } : i),
      })),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: 'accins-cart' }
  )
);