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
  apyLabel: string;
  tvlLabel: string;
  ctaHref: string;
}

// Full set of section anchors mirroring the jump-nav. The CSS hides
// extra ones on narrow screens so this list never wraps.
const QUICK_LINKS: { href: string; label: string }[] = [
  { href: "#about", label: "Overview" },
  { href: "#benchmark", label: "Benchmarks" },
  { href: "#ecosystem", label: "Ecosystem" },
  { href: "#history", label: "History" },
  { href: "#details", label: "Details" },
  { href: "#faq", label: "FAQ" },
];

export function TestStickyHeader({
  productName,
  asset,
  apyLabel,
  tvlLabel,
  ctaHref,
}: Props) {
  const [show, setShow] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Show / hide the bar once the right sentinel scrolls out of view.
  // Desktop sentinel = .uni-jump (jump nav rail). Mobile sentinel =
  // .uni-cta (View Strategy CTA in the hero side card) since the
  // jump nav is hidden on mobile and IntersectionObserver doesn't
  // fire for display:none elements. Re-attaches on resize so a rotate
  // or window-drag picks the right sentinel.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let observer: IntersectionObserver | null = null;

    const attach = () => {
      if (observer) observer.disconnect();
      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      const sentinel = isMobile
        ? document.querySelector(".uni-cta")
        : document.querySelector(".uni-jump");
      if (!sentinel) return;
      observer = new IntersectionObserver(
        ([entry]) => {
          const past =
            !entry.isIntersecting && entry.boundingClientRect.top < 0;
          setShow(past);
        },
        { threshold: 0 },
      );
      observer.observe(sentinel);
    };

    attach();
    window.addEventListener("resize", attach);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", attach);
    };
  }, []);

  // Scroll-spy: highlight the link of the section that's currently
  // dominating the viewport. rootMargin pulls the trigger band into
  // the upper third of the viewport so the highlight tracks the
  // section the user is reading, not just the topmost edge.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ids = QUICK_LINKS.map((l) => l.href.slice(1));
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -55% 0px", threshold: [0, 0.1, 0.5, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`uni-sticky-bar${show ? " visible" : ""}`}
      aria-hidden={!show}
    >
      <div className="uni-sticky-inner">
        <div className="uni-sticky-left">
          <a href="#performance" className="uni-sticky-name-link">
            <AssetIcon asset={asset} size={20} />
            <span className="uni-sticky-name">{productName}</span>
          </a>
          <span className="uni-sticky-stat">
            <span className="uni-sticky-stat-label">APY</span>
            <strong>{apyLabel}</strong>
          </span>
          <span className="uni-sticky-stat">
            <span className="uni-sticky-stat-label">TVL</span>
            <strong>{tvlLabel}</strong>
          </span>
        </div>
        <nav className="uni-sticky-right" aria-label="Jump to section">
          {QUICK_LINKS.map((l) => {
            const id = l.href.slice(1);
            return (
              <a
                key={l.href}
                href={l.href}
                className={activeId === id ? "active" : ""}
              >
                {l.label}
              </a>
            );
          })}
        </nav>
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="uni-sticky-cta"
        >
          View<span className="uni-sticky-cta-strategy"> Strategy</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}
