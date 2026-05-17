"use client";

// Acquisition funnel sub-nav. Sits at the top of every page under
// /admin/acquisition/* and connects the four stages of the
// visitor-to-depositor pipeline:
//   Traffic → Clicks into App → App Net Worth → Deposits (TVL)
// Active step gets a gold pill; the others are muted. Chevrons
// between steps reinforce the funnel direction.

import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = [
  {
    num: "01",
    label: "Traffic",
    href: "/admin/acquisition",
  },
  {
    num: "02",
    label: "Clicks into App",
    href: "/admin/acquisition/clicks-into-app",
  },
  {
    num: "03",
    label: "User Networth",
    href: "/admin/acquisition/app-net-worth",
  },
  {
    num: "04",
    label: "Deposits (TVL)",
    href: "/admin/acquisition/deposits",
  },
] as const;

export function AcquisitionFunnelNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="aq-funnel"
      role="navigation"
      aria-label="Acquisition funnel"
    >
      {STEPS.map((step, i) => {
        // Exact match for the index path; startsWith for nested.
        const active =
          step.href === "/admin/acquisition"
            ? pathname === "/admin/acquisition" ||
              pathname === "/admin/acquisition/"
            : pathname.startsWith(step.href);
        const last = i === STEPS.length - 1;
        return (
          <span key={step.href} className="aq-funnel-cell">
            <Link
              href={step.href}
              className={`aq-funnel-step${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="aq-funnel-step-num">{step.num}</span>
              <span className="aq-funnel-step-label">{step.label}</span>
            </Link>
            {!last && (
              <span className="aq-funnel-chevron" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
