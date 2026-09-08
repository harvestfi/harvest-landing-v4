"use client";

import { useMemo, useState } from "react";
import { OutboundLink } from "@/components/report/outbound-link";
import {
  LEAVE_SITE_BODY,
  OFFERS,
  OFFER_FILTERS,
  keyDetails,
  offerKinds,
  type OfferKind,
} from "@/lib/crypto-casinos-copy";
import { CASINO_LOGOS } from "@/lib/casino-logos";
import {
  COMPLAINT_LABEL,
  UNCONFIRMED,
  KYC_LABEL,
  parseBonus,
  type Casino,
  type CasinoClaims,
  type FieldSource,
} from "@/lib/crypto-casinos";

const UNIT_PREFIX: Record<string, string> = { USD: "$", EUR: "€" };

const BADGES: { key: keyof CasinoClaims; label: string }[] = [
  { key: "noWagering", label: "Advertised no wagering" },
  { key: "noKyc", label: "Advertised no KYC" },
  { key: "rakeback", label: "Rakeback" },
  { key: "cashback", label: "Cashback" },
  { key: "instantWithdrawal", label: "Advertised instant withdrawal" },
  { key: "provablyFair", label: "Provably fair games" },
  { key: "vpnFriendly", label: "VPN friendly" },
];

const BADGE_LIMIT = 2;

function fallbackHeadline(c: Casino): string | null {
  const terms = c.verified.capUsd;
  if (terms != null) return `Up to $${terms.toLocaleString("en-US")}`;
  const p = parseBonus(c.bonusClaim);
  if (p.cap != null && p.unit) {
    const n = p.cap.toLocaleString("en-US");
    return UNIT_PREFIX[p.unit]
      ? `Up to ${UNIT_PREFIX[p.unit]}${n}`
      : `Up to ${n} ${p.unit}`;
  }
  return p.pct != null ? `${p.pct}%` : null;
}

export function CasinoTable({ casinos }: { casinos: Casino[] }) {
  const [kind, setKind] = useState<OfferKind | "all">("all");
  const [noKyc, setNoKyc] = useState(false);
  const [fast, setFast] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      casinos.filter(
        (c) =>
          (kind === "all" || offerKinds(c).includes(kind)) &&
          (!noKyc || c.claimed.noKyc) &&
          (!fast || c.claimed.instantWithdrawal),
      ),
    [casinos, kind, noKyc, fast],
  );

  if (!casinos.length) {
    return <p className="cc-empty">No venues are listed yet.</p>;
  }

  return (
    <div className="cc-rank">
      <div className="cc-filterbar">
        <div className="cc-fgroup" role="group" aria-label="Filter by offer type">
          {OFFER_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`cc-chipbtn${kind === f.key ? " is-on" : ""}`}
              aria-pressed={kind === f.key}
              onClick={() => setKind(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="cc-fgroup" role="group" aria-label="Filter by advertised feature">
          <Toggle on={noKyc} set={setNoKyc} label="Advertised no KYC" />
          <Toggle on={fast} set={setFast} label="Advertised instant withdrawal" />
        </div>
        <span className="cc-count">
          Showing {rows.length} of {casinos.length}
        </span>
      </div>

      <div className="hub-table-wrap" data-voice-skip="">
        <div className="hub-table cc-table">
          <div className="hub-thead">
            <span className="hub-th">#</span>
            <span className="hub-th">Casino</span>
            <span className="hub-th cc-col-offer">Offer</span>
            <span className="hub-th cc-col-keys">Key details</span>
            <span className="hub-th cc-col-act">Action</span>
          </div>
          {rows.map((c, i) => {
            const offer = OFFERS[c.slug];
            const headline = offer?.headline ?? fallbackHeadline(c);
            const support = offer?.support ?? c.bonusClaim;
            const details = keyDetails(c);
            const badges = BADGES.filter((b) => c.claimed[b.key]).slice(0, BADGE_LIMIT);
            const logo = CASINO_LOGOS[c.slug];
            const isOpen = open === c.slug;
            return (
              <div key={c.slug} className="cc-rowgroup" id={c.slug}>
                <div className="hub-row">
                  <span className="hub-cell hub-rank">{i + 1}</span>

                  <span className="hub-cell cc-venue">
                    {logo ? (
                      <span className="cc-logo-box">
                        <img
                          className="cc-logo"
                          src={logo.src}
                          alt=""
                          width={84}
                          height={36}
                          loading="lazy"
                          decoding="async"
                        />
                      </span>
                    ) : null}
                    <span className="cc-venue-txt">
                      <span className="cc-name">{c.name}</span>
                      {offer ? (
                        <span className="cc-summary">{offer.type}</span>
                      ) : null}
                    </span>
                  </span>

                  <span className="hub-cell cc-col-offer cc-offer">
                    {headline ? (
                      <span className="cc-offer-lead">{headline}</span>
                    ) : null}
                    {support ? (
                      <span className="cc-offer-sub">{support}</span>
                    ) : null}
                  </span>

                  <span className="hub-cell cc-col-keys cc-keys">
                    {details.length > 0 && (
                      <span className="cc-keys-list">{details.join(" · ")}</span>
                    )}
                  </span>

                  <span className="hub-cell cc-col-act cc-action">
                    {c.url ? (
                      <OutboundLink
                        className="cc-open cc-play"
                        href={c.url}
                        rel="sponsored nofollow noopener noreferrer"
                        keepHref
                        platform={c.name}
                        source={
                          c.dealStatus === "live"
                            ? "crypto-casinos-row-affiliate"
                            : "crypto-casinos-row-plain"
                        }
                        rank={i + 1}
                        ariaLabel={`Play Now at ${c.name}`}
                        body={LEAVE_SITE_BODY(c.name)}
                      >
                        Play Now
                      </OutboundLink>
                    ) : null}
                    <button
                      type="button"
                      className="cc-details-btn"
                      aria-expanded={isOpen}
                      aria-controls={`cc-d-${c.slug}`}
                      onClick={() => setOpen(isOpen ? null : c.slug)}
                    >
                      {isOpen ? "Hide details" : "Offer details"}
                    </button>
                  </span>

                  {badges.length > 0 && (
                    <span className="hub-cell cc-chips">
                      {badges.map((b) => (
                        <span key={b.key} className="cc-chip">
                          {b.label}
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                {isOpen && <OfferDetails c={c} id={`cc-d-${c.slug}`} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface Row {
  k: string;
  v: string;
  src?: FieldSource | typeof UNCONFIRMED;
  wide?: boolean;
}

function OfferDetails({ c, id }: { c: Casino; id: string }) {
  const v = c.verified;
  const offer = OFFERS[c.slug];

  const terms: Row[] = [];
  if (offer) {
    terms.push({ k: "Offer type", v: offer.type });
    terms.push({ k: "Advertised amount", v: offer.headline });
    if (offer.support) terms.push({ k: "Included", v: offer.support, wide: true });
  }
  if (v.wagering != null) {
    terms.push({
      k: "Wagering",
      v: v.wagering === 0 ? "None on this offer" : `${v.wagering}× the bonus`,
      src: c.sources?.wagering,
    });
  }
  if (c.minDeposit) {
    terms.push({ k: "Minimum crypto deposit", v: c.minDeposit });
  }
  if (c.bonusMinDeposit) {
    terms.push({ k: "Minimum deposit for this bonus", v: c.bonusMinDeposit });
  }

  const operator: Row[] = [
    {
      k: "Operating company",
      v: c.operator ?? "Not named in the pages read here",
      wide: c.operator == null,
    },
    {
      k: "Licence",
      v: v.licence
        ? `${v.licence.authority}${v.licence.number ? `, ${v.licence.number}` : ""}`
        : "Not confirmed",
      src: c.sources?.licence,
      wide: Boolean(v.licence),
    },
  ];
  if (v.withdrawal) {
    operator.push({
      k: "Published withdrawal time",
      v: v.withdrawal,
      src: c.sources?.withdrawal,
    });
  }
  if (c.claimed.instantWithdrawal && v.withdrawal && v.withdrawal !== "instant") {
    operator.push({
      k: "Also advertises",
      v: "Instant withdrawals. Where the published figure and the advertising disagree, the row shows the published one.",
      wide: true,
    });
  }
  if (v.kyc) {
    operator.push({ k: "Identity checks", v: KYC_LABEL[v.kyc], src: c.sources?.kyc });
  }
  const sameBothWays =
    v.chains?.length &&
    v.payoutCoins?.length &&
    v.chains.length === v.payoutCoins.length &&
    v.chains.every((x) => v.payoutCoins?.includes(x));
  if (sameBothWays && v.chains) {
    operator.push({
      k: `Deposit and payout coins (${v.chains.length})`,
      v: v.chains.join(", "),
      src: c.sources?.payoutCoins ?? c.sources?.chains,
      wide: true,
    });
  } else {
    if (v.chains?.length) {
      operator.push({
        k: `Deposit coins (${v.chains.length})`,
        v: v.chains.join(", "),
        src: c.sources?.chains,
        wide: true,
      });
    }
    operator.push(
      v.payoutCoins?.length
        ? {
            k: `Crypto payouts (${v.payoutCoins.length})`,
            v: v.payoutCoins.join(", "),
            src: c.sources?.payoutCoins,
            wide: true,
          }
        : {
            k: "Crypto payouts",
            v: "Withdrawal currencies have not been reviewed for this casino yet. A deposit coin is not automatically a payout coin.",
            wide: true,
          },
    );
  }
  if (v.gameTypes?.length) {
    operator.push({
      k: "Games",
      v: v.gameTypes.join(", "),
      src: c.sources?.gameTypes,
      wide: true,
    });
  }
  if (v.complaints) {
    operator.push({
      k: "Complaints",
      v: COMPLAINT_LABEL[v.complaints],
      src: c.sources?.complaints,
    });
  }

  return (
    <div className="cc-detail" id={id}>
      <div className="cc-panels">
        <FactTable title="Offer terms" rows={terms} />
        <FactTable title="Operator and payments" rows={operator} />
      </div>
      {(c.termsNote || c.claims.length > 0) && (
        <div className="cc-notes">
          {c.termsNote ? (
            <p>
              <strong>Noted in the terms.</strong> {c.termsNote}
            </p>
          ) : null}
          {c.claims.length > 0 ? (
            <p>
              <strong>Also advertised.</strong> {c.claims.join(" · ")}
            </p>
          ) : null}
        </div>
      )}
      <p className="cc-detail-foot">
        {c.lastChecked
          ? `Terms last read ${c.lastChecked}.`
          : "The terms behind this offer have not been read yet, so everything above is the operator’s own wording."}
      </p>
    </div>
  );
}

function FactTable({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="cc-panel">
      <p className="cc-panel-head">{title}</p>
      <dl className="cc-panel-rows">
        {rows.map((r) => (
          <div
            className={`cc-panel-row${r.wide ? " is-wide" : ""}`}
            key={`${title}-${r.k}`}
          >
            <dt>{r.k}</dt>
            <dd>
              {r.v}
              <Src src={r.src} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Src({ src }: { src?: FieldSource | typeof UNCONFIRMED }) {
  if (!src) return null;
  if (src === UNCONFIRMED) {
    return (
      <span className="cc-detail-src">Not confirmed at the venue</span>
    );
  }
  return (
    <span className="cc-detail-src">
      <a href={src.url} rel="nofollow noopener noreferrer" target="_blank">
        {new URL(src.url).hostname.replace(/^www\./, "")}
      </a>
      , read {src.readOn}
    </span>
  );
}

function Toggle({
  on,
  set,
  label,
}: {
  on: boolean;
  set: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`cc-chipbtn${on ? " is-on" : ""}`}
      aria-pressed={on}
      onClick={() => set(!on)}
    >
      {label}
    </button>
  );
}
