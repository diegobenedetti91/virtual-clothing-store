import { prisma } from "@/lib/prisma";
import BlingClientSyncButton from "@/components/admin/BlingClientSyncButton";
import ClientesManager, { type CustomerRow } from "@/components/admin/ClientesManager";

export const dynamic = "force-dynamic";

const PAID = ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"];

export default async function ClientesPage() {
  const [settings, customers] = await Promise.all([
    prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { blingAtivo: true } }),
    prisma.customerUser.findMany({
      select: {
        id: true, name: true, email: true, phone: true, cpfCnpj: true,
        street: true, number: true, neighborhood: true, city: true, state: true, zipCode: true,
        blingContatoId: true, createdAt: true,
        orders: {
          select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { wishlist: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Agregados calculados aqui para a tela não depender de várias chamadas
  const rows: CustomerRow[] = customers.map((c) => {
    const paid = c.orders.filter((o) => PAID.includes(o.status));
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      cpfCnpj: c.cpfCnpj,
      street: c.street,
      number: c.number,
      neighborhood: c.neighborhood,
      city: c.city,
      state: c.state,
      zipCode: c.zipCode,
      inBling: !!c.blingContatoId,
      createdAt: c.createdAt.toISOString(),
      paidCount: paid.length,
      deliveredCount: c.orders.filter((o) => o.status === "DELIVERED" || o.status === "RETIRADO").length,
      cancelledCount: c.orders.filter((o) => o.status === "CANCELLED").length,
      pendingCount: c.orders.filter((o) => o.status === "PENDING").length,
      wishlistCount: c._count.wishlist,
      totalSpent: paid.reduce((s, o) => s + o.total, 0),
      lastOrderAt: paid[0]?.createdAt.toISOString() ?? null,
      recentOrders: c.orders.slice(0, 8).map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">Quem comprou, quanto gastou e quando voltou. Clique num cliente para ver a ficha completa.</p>
        </div>
        {settings?.blingAtivo && <BlingClientSyncButton />}
      </div>
      <ClientesManager customers={rows} />
    </div>
  );
}
