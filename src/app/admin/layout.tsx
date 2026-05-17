import type { Metadata } from "next";
import Link from "next/link";

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
      <nav className="admin-nav">
        <div className="admin-nav-inner">
          <Link
            href="/"
            className="brand admin-brand"
            aria-label="Harvest, go to homepage"
          >
            <span className="brand-name">Harvest</span>
            <span className="brand-dot" aria-hidden="true" />
            <span className="admin-brand-tag">Admin</span>
          </Link>
          <div className="admin-nav-links">
            <Link href="/admin" className="admin-nav-link">
              SEO Overview
            </Link>
            <Link href="/admin/products" className="admin-nav-link">
              Products
            </Link>
            <Link href="/admin/ranking-rules" className="admin-nav-link">
              Ranking Rules
            </Link>
            <Link href="/admin/master-rules" className="admin-nav-link">
              Master Rules
            </Link>
            <Link href="/admin/acquisition" className="admin-nav-link">
              Acquisition
            </Link>
            <Link href="/admin/studio" className="admin-nav-link">
              Studio
            </Link>
            <Link href="/admin/changelog" className="admin-nav-link">
              Changelog
            </Link>
          </div>
          <Link href="/" className="admin-nav-back">
            ← Back to site
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
