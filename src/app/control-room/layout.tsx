import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ControlRoomGate } from "@/components/admin/control-room-gate";

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
