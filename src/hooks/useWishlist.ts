"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  slug: string;
}

interface WishlistStore {
  items: WishlistItem[];
  toggle: (item: WishlistItem) => void;
  has: (productId: string) => boolean;
  count: () => number;
}

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],

      toggle: (item) => {
        set((state) => {
          const exists = state.items.some((i) => i.productId === item.productId);
          return {
            items: exists
              ? state.items.filter((i) => i.productId !== item.productId)
              : [...state.items, item],
          };
        });
      },

      has: (productId) => get().items.some((i) => i.productId === productId),

      count: () => get().items.length,
    }),
    { name: "wishlist-storage" }
  )
);
