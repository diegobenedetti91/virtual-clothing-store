"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX = 16;

interface RecentlyViewedStore {
  /** Ids dos produtos vistos, do mais recente para o mais antigo */
  ids: string[];
  add: (id: string) => void;
  clear: () => void;
}

/** Produtos que o cliente abriu neste navegador (só ids; preço e foto vêm sempre atualizados da API). */
export const useRecentlyViewed = create<RecentlyViewedStore>()(
  persist(
    (set) => ({
      ids: [],
      add: (id) => set((s) => ({ ids: [id, ...s.ids.filter((x) => x !== id)].slice(0, MAX) })),
      clear: () => set({ ids: [] }),
    }),
    { name: "recently-viewed" }
  )
);
