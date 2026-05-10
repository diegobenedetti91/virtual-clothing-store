"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/hooks/useCart";
import { useCustomer } from "@/hooks/useCustomer";

export default function CartSyncer() {
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clearCart);
  const customer = useCustomer((s) => s.customer);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!customer?.email) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (items.length === 0) {
      fetch(`/api/cart/save?email=${encodeURIComponent(customer.email)}`, { method: "DELETE" }).catch(() => {});
      return;
    }

    timerRef.current = setTimeout(() => {
      fetch("/api/cart/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customer.email, cartItems: items }),
      }).catch(() => {});
    }, 3000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [items, customer?.email, clearCart]);

  return null;
}
