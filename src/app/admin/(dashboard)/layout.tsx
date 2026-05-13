export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getCompanySettings } from "@/lib/company";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth().catch(() => null);
  const user = (session?.user ?? { name: null, email: null }) as { name?: string | null; email?: string | null };
  const settings = await getCompanySettings();
  const brandColor = settings?.buttonColor || settings?.primaryColor || "#ec4899";

  return (
    <div className="flex min-h-screen bg-gray-50" style={{ "--brand": brandColor } as React.CSSProperties}>
      <AdminSidebar user={user} />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
