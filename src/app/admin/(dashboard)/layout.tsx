export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import { getCompanySettings } from "@/lib/company";
import { getAdminAlerts, type AdminBadges } from "@/lib/adminAlerts";

const NO_BADGES: AdminBadges = { pedidos: 0, esteira: 0, rastreamento: 0, devolucoes: 0, avaliacoes: 0, produtos: 0 };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, settings, alertData] = await Promise.all([
    auth().catch(() => null),
    getCompanySettings(),
    // Contadores do menu nunca devem derrubar o painel
    getAdminAlerts().catch((e) => {
      console.error("[AdminLayout] Falha ao calcular pendências:", e);
      return null;
    }),
  ]);
  const user = (session?.user ?? { name: null, email: null }) as { name?: string | null; email?: string | null };
  const brandColor = settings?.buttonColor || settings?.primaryColor || "#ec4899";

  return (
    <div style={{ "--brand": brandColor } as React.CSSProperties}>
      <AdminShell user={user} badges={alertData?.badges ?? NO_BADGES} storeName={settings?.name} logo={settings?.logo}>
        {children}
      </AdminShell>
    </div>
  );
}
