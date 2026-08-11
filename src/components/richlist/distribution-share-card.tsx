"use client";

// "Download as image" for the balance-band table on /xrp-rich-list.
//
// Balance-band tables circulate on X constantly and the format clearly works:
// bands down one side, account counts and XRP held beside them. The ones that
// go around are consistently missing two things. They start at 500 XRP, which
// drops roughly eight in ten accounts and quietly overstates the typical
// holder, and they carry no ledger number or date, so a reader cannot tell
// when the numbers were true or check them against anything.
//
// This renders the full distribution, every band down to the dust, and stamps
// the ledger, the date and the domain into the image. A screenshot of a
// screenshot stays attributable, which is the point of making it easy to take.
//
// It deliberately does NOT repeat the table in HTML. DistributionTable above
// is the crawlable, screen-readable twin and there should be exactly one of
// those. This is only the action plus the canvas it draws.
//
// The PNG is drawn with the Canvas 2D API rather than by rasterising the DOM.
// The html-to-image approach depends on foreignObject, which fails silently in
// several of the browsers people screenshot from, and a share button that
// produces a blank file is worse than no share button.

import { useCallback, useState } from "react";
import type { Band } from "./distribution-chart";
import { bandName } from "./distribution-chart";

const int = (n: number) => Math.round(n).toLocaleString("en-US");

const xrpSum = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}bn`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return int(n);
};

const pct = (v: number): string => (v >= 0.01 ? `${v.toFixed(2)}%` : "<0.01%");

export function DistributionShareCard({
  bands,
  snapshotDate,
  ledgerIndex,
  totalAccounts,
  totalXrp,
}: {
  bands: Band[];
  snapshotDate: string;
  ledgerIndex: number;
  totalAccounts: number;
  totalXrp: number;
}) {
  const rows = bands.filter((b) => b.accounts > 0);
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">("idle");

  const download = useCallback(() => {
    setState("working");
    try {
      const scale = 2;
      const padX = 34;
      const rowH = 30;
      const w = 780;
      const headH = 122;
      const footH = 58;
      const h = headH + (rows.length + 1) * rowH + footH;

      const cv = document.createElement("canvas");
      cv.width = w * scale;
      cv.height = h * scale;
      const g = cv.getContext("2d");
      if (!g) {
        setState("failed");
        return;
      }
      g.scale(scale, scale);

      const ink = "#191717";
      const dim = "#6b6a64";
      const line = "#e2e3e0";
      const sans =
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif';

      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#ffb936";
      g.fillRect(0, 0, w, 6);

      let y = 44;
      g.fillStyle = ink;
      g.font = `700 24px ${sans}`;
      g.fillText("XRP holder distribution", padX, y);

      y += 25;
      g.fillStyle = dim;
      g.font = `400 14px ${sans}`;
      g.fillText(
        `All ${int(totalAccounts)} funded accounts on the XRP Ledger, ${snapshotDate}`,
        padX,
        y,
      );
      y += 20;
      const mean = totalAccounts > 0 ? totalXrp / totalAccounts : 0;
      g.fillText(`Average per account ${int(mean)} XRP`, padX, y);

      const cBand = padX;
      const cAcct = 410;
      const cXrp = 575;
      const cPct = w - padX;

      y = headH - 12;
      g.fillStyle = dim;
      g.font = `600 11.5px ${sans}`;
      g.fillText("BALANCE BAND (XRP)", cBand, y);
      g.textAlign = "right";
      g.fillText("ACCOUNTS", cAcct, y);
      g.fillText("XRP HELD", cXrp, y);
      g.fillText("% OF XRP", cPct, y);
      g.textAlign = "left";

      y += 9;
      g.strokeStyle = line;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(padX, y + 0.5);
      g.lineTo(w - padX, y + 0.5);
      g.stroke();

      rows.forEach((b, i) => {
        const ry = y + (i + 1) * rowH - 9;
        if (i % 2 === 1) {
          g.fillStyle = "#faf9f7";
          g.fillRect(padX - 10, ry - 19, w - 2 * padX + 20, rowH);
        }
        g.fillStyle = ink;
        g.font = `500 14px ${sans}`;
        g.fillText(bandName(b), cBand, ry);
        g.font = `400 14px ${sans}`;
        g.textAlign = "right";
        g.fillText(int(b.accounts), cAcct, ry);
        g.fillText(xrpSum(b.xrpHeld), cXrp, ry);
        g.fillStyle = dim;
        g.fillText(pct(b.pctOfXrp), cPct, ry);
        g.textAlign = "left";
      });

      const fy = y + (rows.length + 1) * rowH + 16;
      g.strokeStyle = line;
      g.beginPath();
      g.moveTo(padX, fy - 20.5);
      g.lineTo(w - padX, fy - 20.5);
      g.stroke();
      g.fillStyle = ink;
      g.font = `600 13px ${sans}`;
      g.fillText("harvest.finance/xrp-rich-list", padX, fy);
      g.fillStyle = dim;
      g.font = `400 12px ${sans}`;
      g.textAlign = "right";
      g.fillText(`Read from XRP Ledger ${int(ledgerIndex)}`, w - padX, fy);

      cv.toBlob((blob) => {
        if (!blob) {
          setState("failed");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `xrp-holder-distribution-${ledgerIndex}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setState("done");
      }, "image/png");
    } catch {
      setState("failed");
    }
  }, [rows, snapshotDate, ledgerIndex, totalAccounts, totalXrp]);

  if (rows.length < 2) return null;

  return (
    <div className="rl-share">
      <button
        type="button"
        className="rl-share-btn"
        onClick={download}
        disabled={state === "working"}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5" />
          <path d="M12 15V3" />
        </svg>
        {state === "working" ? "Preparing" : "Download this table as an image"}
      </button>
      <span className="rl-share-hint">
        {state === "failed"
          ? "That did not work in this browser. The table above screenshots fine."
          : `The image carries the ledger number and the date, so it stays checkable after it is shared.`}
      </span>
    </div>
  );
}
