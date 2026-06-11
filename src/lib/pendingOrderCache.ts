interface PendingOrderData {
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  notes: string | null;
  customerId: string | null;
  subtotal: number;
  items: Array<{
    productId: string;
    quantity: number;
    size?: string;
    color?: string;
    selectedAttributes?: Record<string, string>;
  }>;
}

// In-memory cache for pending orders (webhook will retrieve and create order)
const pendingOrders = new Map<string, PendingOrderData>();

export function cachePendingOrder(orderNumber: string, data: PendingOrderData): void {
  pendingOrders.set(orderNumber, data);
  // Auto-cleanup after 2 hours (webhook should arrive within minutes)
  setTimeout(() => pendingOrders.delete(orderNumber), 7200000);
}

export function getPendingOrder(orderNumber: string): PendingOrderData | undefined {
  return pendingOrders.get(orderNumber);
}

export function removePendingOrder(orderNumber: string): void {
  pendingOrders.delete(orderNumber);
}
