import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  id: number;
  nombre: string;
  precio: number;
  sku: string | null;
  image_url?: string | null;
  image_webp?: string | null;
  qty: number;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (id: number) => void;
  setQty: (id: number, qty: number) => void;
  clear: () => void;
  count: () => number;
  total: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.id === item.id);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.id === item.id ? { ...i, qty: i.qty + qty } : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, qty }] };
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      setQty: (id, qty) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.id === id ? { ...i, qty } : i))
            .filter((i) => i.qty > 0),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((a, b) => a + b.qty, 0),
      total: () => get().items.reduce((a, b) => a + b.qty * (b.precio || 0), 0),
    }),
    { name: "decasan-cart" },
  ),
);
