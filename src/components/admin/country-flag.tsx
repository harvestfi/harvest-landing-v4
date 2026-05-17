// Country flag rendered as a tiny PNG from flagcdn.com (free public
// CDN, returns "/w20/{iso}.png" - 20px wide, 4:3 aspect, ~600 bytes
// per flag). Picked over Unicode regional-indicator emoji because
// Windows + most Linux browsers don't render those as flags - they
// show two letter glyphs instead. Picked over a bundled npm icon
// pack to keep the static export bundle slim; the admin pages are
// the only consumer.
//
// Plain <img> rather than next/image because the admin pages are
// fetched at runtime and never see the build-time optimiser; the
// static export config has images.unoptimized: true anyway.
//
// Falls back to a neutral globe glyph when the value isn't a clean
// 2-letter ISO code (covers null, legacy free-text country names,
// and the rare "EU"/"XK" non-ISO entries).

interface Props {
  // ISO 3166-1 alpha-2 country code as written by lib/analytics
  // fetchGeo (e.g. "US", "DE", "PL"). Lower-cased before the URL
  // lookup; flagcdn.com routes are case-insensitive in practice but
  // the docs use lowercase.
  country: string | null | undefined;
}

export function CountryFlag({ country }: Props) {
  const iso = (country ?? "").trim();
  const isValid = /^[A-Za-z]{2}$/.test(iso);

  return (
    <span className="country-cell" aria-label={isValid ? iso.toUpperCase() : "Unknown"}>
      {isValid ? (
        <img
          src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
          srcSet={`https://flagcdn.com/w40/${iso.toLowerCase()}.png 1x, https://flagcdn.com/w80/${iso.toLowerCase()}.png 2x`}
          alt={iso.toUpperCase()}
          width={20}
          height={15}
          className="country-flag"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="country-flag country-flag-unknown" aria-hidden="true">
          ◍
        </span>
      )}
      <span className="country-code">{isValid ? iso.toUpperCase() : "—"}</span>
    </span>
  );
}
