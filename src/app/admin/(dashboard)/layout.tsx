import { auth } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = (session?.user ?? { name: null, email: null }) as { name?: string | null; email?: string | null };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar user={user} />
      <main className="flex-1 ml-0 md:ml-64 p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
