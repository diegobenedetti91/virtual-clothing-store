import { prisma } from "@/lib/prisma";

/**
 * Server-side counterpart of `track()` from "@/lib/analytics", which only works in
 * the browser. Writes the analytics event straight to the database.
 */
export async function trackServer(
  type: string,
  data: { productId?: string | null; customerId?: string | null; orderId?: string | null; path?: string | null; value?: number | null } = {}
): Promise<void> {
  await prisma.analyticsEvent.create({
    data: {
      type,
      productId: data.productId || null,
      customerId: data.customerId || null,
      orderId: data.orderId || null,
      path: data.path || null,
      value: data.value ?? null,
    },
  });
}
