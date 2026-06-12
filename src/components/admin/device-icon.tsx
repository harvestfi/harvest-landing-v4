// Device glyph for the Live Feed / SEO Summary "Device" column. Takes
// the stored device_type string ("desktop" | "tablet" | "mobile",
// written by parseUserAgent in lib/analytics) and renders the matching
// outline icon with a title, or an em-dash when unknown/missing.

function normalizeDevice(
  device: string | null | undefined,
): "desktop" | "tablet" | "mobile" | null {
  const d = (device || "").toLowerCase();
  if (!d) return null;
  if (d.includes("mobile") || d.includes("phone")) return "mobile";
  if (d.includes("tablet") || d.includes("ipad")) return "tablet";
  if (d.includes("desktop")) return "desktop";
  return null;
}

export function DeviceIcon({ device }: { device: string | null | undefined }) {
  const type = normalizeDevice(device);
  if (!type) return <span className="lf-dim">—</span>;
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return (
    <span className="lf-device" title={label} aria-label={label}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {type === "desktop" ? (
          <>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </>
        ) : type === "tablet" ? (
          <>
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M12 18h.01" />
          </>
        ) : (
          <>
            <rect x="7" y="2" width="10" height="20" rx="2.2" />
            <path d="M12 18h.01" />
          </>
        )}
      </svg>
    </span>
  );
}
