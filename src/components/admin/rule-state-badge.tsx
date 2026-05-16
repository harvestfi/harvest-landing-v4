"use client";

// Read-only state badge for the /admin/ranking-rules page. The
// site is a static export, so rules can't be flipped at runtime -
// changing one requires editing src/lib/admin-rules.ts and
// committing. The old FlipSwitch *looked* like a toggle, which
// invited operators to click it expecting a state change. This
// component instead renders an unambiguous ON/OFF pill plus a
// click-to-copy "source path" affordance so the operator gets
// concrete feedback when they want to flip a rule.

import { useState } from "react";

export function RuleStateBadge({
  enabled,
  source,
}: {
  enabled: boolean;
  source: string;
}) {
  const [copied, setCopied] = useState(false);

  function copySource() {
    if (typeof navigator === "undefined") return;
    navigator.clipboard
      ?.writeText(source)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Permissions blocked or unsupported - silently no-op.
        // The visible source path is still selectable manually.
      });
  }

  return (
    <div className="flex flex-shrink-0 flex-col items-end gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
          enabled
            ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
            : "bg-gray-100 text-gray-500 ring-1 ring-gray-300"
        }`}
        aria-label={enabled ? "Rule is currently ON" : "Rule is currently OFF"}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-gray-400"}`}
          aria-hidden="true"
        />
        {enabled ? "On" : "Off"}
      </span>
      <button
        type="button"
        onClick={copySource}
        className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
        title="Click to copy the source path. Edit it locally, commit, push — Vercel rebuilds within a minute."
      >
        <span aria-hidden="true">{copied ? "✓" : "⧉"}</span>
        {copied ? "Copied" : "Copy source path"}
      </button>
    </div>
  );
}
