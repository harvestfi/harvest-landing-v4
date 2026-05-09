"use client";

// Mobile-only sticky sub-bar that appears once the user has
// scrolled past the jump-to nav. Mirrors the Uniswap pool detail
// "second nav" pattern: asset icon + product name on the left,
// quick jump links on the right, pinned below the global topnav.
// Scroll detection uses IntersectionObserver on a sentinel
// (.uni-jump element) so we don't run a scroll listener at 60Hz.

import { useEffect, useState } from "react";
import { AssetIcon } from "./token-icons";

interface Props {
  productName: string;
  asset: string;
}

const QUICK_LINKS: { href: string; label: string }[] = [
  { href: "#performance", label: "Perf" },
  { href: "#benchmark", label: "Bench" },
  { href: "#history", label: "Hist" },
  { href: "#faq", label: "FAQ" },
];

export function TestStickyHeader({ productName, asset }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sentinel = document.querySelector(".uni-jump");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show the sticky bar once the jump nav is fully out of view
        // ABOVE the viewport (i.e. user has scrolled past it).
        const past =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setShow(past);
      },
      { threshold: 0, rootMargin: "0px 0px 0px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`uni-sticky-bar${show ? " visible" : ""}`}
      aria-hidden={!show}
    >
      <div className="uni-sticky-inner">
        <a href="#performance" className="uni-sticky-left">
          <AssetIcon asset={asset} size={20} />
          <span className="uni-sticky-name">{productName}</span>
        </a>
        <nav className="uni-sticky-right" aria-label="Jump to section">
          {QUICK_LINKS.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>
      </div>
    </div>
  );
}
