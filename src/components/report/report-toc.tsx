"use client";

// Right-rail "In this report" table of contents for /report/* pages. A
// left-border tree (per the Base-docs Figma): the section nearest the top of
// the viewport is highlighted, its rail turning the accent blue. Scroll-spy via
// IntersectionObserver on the section heading ids; no dependency, no layout
// cost (the rail is sticky and hidden on narrow screens).

import { useEffect, useState } from "react";

export interface TocItem {
  id: string;
  label: string;
  level?: number; // 0 = section, 1 = sub-section
}

export function ReportToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    const visible = new Set<string>();
    const pickTop = () => {
      // The active entry is the first item (in document order) currently in the
      // reading band. Falls back to the last one scrolled past.
      let chosen = "";
      for (const it of items) {
        if (visible.has(it.id)) {
          chosen = it.id;
          break;
        }
      }
      if (chosen) setActive(chosen);
    };

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        pickTop();
      },
      // Reading band: just under the sticky header down to ~40% of the viewport.
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav className="rp-toc-tree" aria-label="In this report">
      <p className="rp-toc-tree-head">In this report</p>
      <ul>
        {items.map((it) => (
          <li
            key={it.id}
            className={`rp-toc-node lvl-${it.level ?? 0}${
              active === it.id ? " is-active" : ""
            }`}
          >
            <a href={`#${it.id}`} onClick={() => setActive(it.id)}>
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
