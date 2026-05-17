import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata: Metadata = {
  title: "Admin Panel",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-content">{children}</main>
    </div>
  );
}
