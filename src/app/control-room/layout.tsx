import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ControlRoomGate } from "@/components/admin/control-room-gate";
// Admin-only styles, scoped to the control room so they don't ship in the
// render-blocking global bundle that public pages load. The public design
// system still comes from globals.css (root layout); these layer on top.
import "../_styles/admin.css";

export const metadata: Metadata = {
  title: "Control Room",
  robots: { index: false, follow: false },
};

export default function ControlRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ControlRoomGate>
      <div className="admin-shell">
        <AdminSidebar />
        <main className="admin-content">{children}</main>
      </div>
    </ControlRoomGate>
  );
}
