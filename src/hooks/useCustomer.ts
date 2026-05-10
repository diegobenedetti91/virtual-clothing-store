"use client";

import { create } from "zustand";

interface Customer {
  id: string;
  email: string;
  name: string;
}

interface CustomerStore {
  customer: Customer | null;
  loading: boolean;
  login: (c: Customer) => void;
  logout: () => void;
  init: () => Promise<void>;
}

export const useCustomer = create<CustomerStore>((set) => ({
  customer: null,
  loading: true,

  login: (customer) => set({ customer, loading: false }),

  logout: () => set({ customer: null, loading: false }),

  init: async () => {
    try {
      const res = await fetch("/api/customer/me");
      const data = await res.json();
      set({ customer: data || null, loading: false });
    } catch {
      set({ customer: null, loading: false });
    }
  },
}));
