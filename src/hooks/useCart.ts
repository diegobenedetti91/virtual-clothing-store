"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem } from "@/types";
import { variantKey } from "@/lib/variantUtils";

function itemKey(item: Pick<CartItem, "productId" | "selectedAttributes" | "size" | "color">): string {
  if (item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0) {
    return `${item.productId}::${variantKey(item.selectedAttributes)}`;
  }
  return `${item.productId}::${item.size ?? ""}::${item.color ?? ""}`;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, selectedAttributes?: Record<string, string>, size?: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, selectedAttributes?: Record<string, string>, size?: string, color?: string) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          const key = itemKey(item);
          const existing = state.items.find((i) => itemKey(i) === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                itemKey(i) === key ? { ...i, quantity: i.quantity + item.quantity } : i
              ),
            };
          }
          return { items: [...state.items, item] };
        });
      },

      removeItem: (productId, selectedAttributes, size, color) => {
        const key = itemKey({ productId, selectedAttributes, size, color });
        set((state) => ({
          items: state.items.filter((i) => itemKey(i) !== key),
        }));
      },

      updateQuantity: (productId, quantity, selectedAttributes, size, color) => {
        if (quantity <= 0) {
          get().removeItem(productId, selectedAttributes, size, color);
          return;
        }
        const key = itemKey({ productId, selectedAttributes, size, color });
        set((state) => ({
          items: state.items.map((i) =>
            itemKey(i) === key ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: "cart-storage" }
  )
);
