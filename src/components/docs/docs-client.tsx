"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Docs page behaviour: expanding menu branches, the mobile menu,
// and highlighting the current section in "On this page".
export function DocsClient() {
  const pathname = usePathname();

  useEffect(() => {
    const shell = document.querySelector(".docs-shell");
    if (!shell) return;
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const tw = target.closest(".docs-tw");
      if (tw) {
        const li = tw.closest("li");
        li?.classList.toggle("open");
        tw.setAttribute("aria-expanded", String(!!li?.classList.contains("open")));
        return;
      }
      const btn = target.closest(".docs-menu-btn");
      if (btn) {
        shell.classList.toggle("menu-open");
        btn.setAttribute("aria-expanded", String(shell.classList.contains("menu-open")));
        return;
      }
      if (target.closest(".docs-sidebar a")) shell.classList.remove("menu-open");
    };
    shell.addEventListener("click", onClick);

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".docs-toc a"));
    let io: IntersectionObserver | undefined;
    if (links.length && "IntersectionObserver" in window) {
      const byId = new Map(links.map((a) => [a.getAttribute("href")!.slice(1), a]));
      io = new IntersectionObserver(
        (entries) => {
          for (const en of entries) {
            if (!en.isIntersecting) continue;
            links.forEach((a) => a.classList.remove("on"));
            byId.get(en.target.id)?.classList.add("on");
          }
        },
        { rootMargin: "-70px 0px -70% 0px" },
      );
      byId.forEach((_, id) => {
        const h = document.getElementById(id);
        if (h) io!.observe(h);
      });
    }
    return () => {
      shell.removeEventListener("click", onClick);
      io?.disconnect();
    };
  }, [pathname]);

  return null;
}
