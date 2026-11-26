"use client";

// "You are leaving Harvest": a gentle confirmation before any link inside
// `scope` opens a site Harvest does not run. Mounted once per page; it listens
// at the document so it also covers links rendered by other components.
// It also makes a table row marked `data-rowlink` act as its own name link.
import { useEffect, useRef, useState } from "react";

const isHarvest = (host: string) => host === "harvest.finance" || host.endsWith(".harvest.finance");

export function LeaveGuard({ scope }: { scope: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [to, setTo] = useState<URL | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest || !t.closest(scope) || t.closest("dialog")) return;
      let a = t.closest<HTMLAnchorElement>("a[href]");
      let fromRow = false;
      if (!a) {
        if (t.closest("button,input,select,label")) return;
        a = t.closest("tr[data-rowlink]")?.querySelector<HTMLAnchorElement>("a.rk-name[href]") ?? null;
        fromRow = true;
      }
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(url.protocol)) return;
      if (isHarvest(url.hostname) || url.hostname === window.location.hostname) {
        if (fromRow) a.click(); // same site: just follow the row's link
        return;
      }
      e.preventDefault();
      setTo(url);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [scope]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (to && !d.open) d.showModal();
    if (!to && d.open) d.close();
  }, [to]);

  return (
    <dialog
      ref={dialog}
      className="uyr-leave"
      aria-labelledby="uyr-leave-h"
      onClose={() => setTo(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) setTo(null); // click on the backdrop
      }}
    >
      {to ? (
        <div className="uyr-leave-in">
          <h2 id="uyr-leave-h">You are leaving Harvest</h2>
          <p>
            This link opens <strong>{to.hostname}</strong>, a site Harvest Finance does not run. Check the address
            before you connect a wallet there.
          </p>
          <div className="uyr-leave-act">
            <button type="button" className="uyr-leave-stay" onClick={() => setTo(null)}>
              Stay on Harvest
            </button>
            <a
              className="uyr-leave-go"
              href={to.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTo(null)}
            >
              Continue
            </a>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
