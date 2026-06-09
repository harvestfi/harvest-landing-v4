import { getVaults } from "@/lib/data";
import {
  RANKING_RULES,
  isAerodromeName,
  HIDE_AERODROME,
  HIDE_LP_PAIR,
} from "@/lib/admin-rules";
import { isLpPairVault } from "@/lib/lp-pair";
import { RuleStateBadge } from "@/components/admin/rule-state-badge";
import "../../_styles/asset-hub.css";

export const metadata = {
  title: "Ranking Rules | Admin",
  robots: { index: false, follow: false },
};

export default async function RankingRulesPage() {
  const vaults = await getVaults();

  // Live counts so the operator can see how many vaults each rule
  // currently removes from the public index.
  const totals = {
    all: vaults.length,
    aerodromeMatches: vaults.filter((v) =>
      isAerodromeName(v.productName, v.category),
    ).length,
    lpPairMatches: vaults.filter((v) => isLpPairVault(v)).length,
  };
  const activeRules = RANKING_RULES.filter((r) => r.enabled).length;

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <div>
            <h1 className="uni-hub-h1">Ranking Rules</h1>
            <p className="uni-hub-sub">
              Editorial filters applied to every public ranking surface
              (homepage, asset hubs, network hubs, related vaults, ticker
              strip, sitemap). Rules are configuration-as-code: flipping a
              switch requires a commit and a rebuild.
            </p>
          </div>
        </div>

        <div
          className="uni-hub-stats"
          role="group"
          aria-label="Rules summary"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
        >
          <Stat label="Total vaults" value={totals.all.toLocaleString("en-US")} />
          <Stat
            label="Active rules"
            value={`${activeRules} of ${RANKING_RULES.length}`}
            mono={false}
          />
          <Stat
            label="Aerodrome matches"
            value={totals.aerodromeMatches.toLocaleString("en-US")}
          />
          <Stat
            label="LP-pair matches"
            value={totals.lpPairMatches.toLocaleString("en-US")}
          />
        </div>
      </header>

      <section className="uni-hub-section" style={{ marginTop: 0 }}>
        <header className="uni-hub-section-head">
          <h2 className="uni-hub-section-title">Rules</h2>
          <span className="uni-hub-section-meta">
            {activeRules} of {RANKING_RULES.length} enabled
          </span>
        </header>

        <div className="rules-cards">
          {RANKING_RULES.map((rule) => (
            <article key={rule.id} className="rules-card rules-card-static">
              <div className="rules-card-head">
                <h3 className="rules-card-title">{rule.name}</h3>
                <RuleStateBadge enabled={rule.enabled} source={rule.source} />
              </div>
              <p className="rules-card-blurb">{rule.rationale}</p>
              <p className="rules-card-source mono">{rule.source}</p>

              {rule.id === "hide-aerodrome" && (
                <div className="rules-card-stat">
                  {totals.aerodromeMatches > 0 ? (
                    <>
                      Currently matching{" "}
                      <strong>{totals.aerodromeMatches}</strong> of {totals.all}{" "}
                      indexed vaults.{" "}
                      {HIDE_AERODROME
                        ? "All hidden from public surfaces."
                        : "All currently visible (rule is OFF; the broader LP-pair rule above already hides their LP variants)."}
                    </>
                  ) : (
                    <>No Aerodrome strategies in the current index.</>
                  )}
                </div>
              )}

              {rule.id === "hide-lp-pair" && (
                <div className="rules-card-stat">
                  {totals.lpPairMatches > 0 ? (
                    <>
                      Currently matching{" "}
                      <strong>{totals.lpPairMatches}</strong> of {totals.all}{" "}
                      indexed vaults.{" "}
                      {HIDE_LP_PAIR
                        ? "All hidden from public surfaces (product pages remain reachable by direct URL but are dropped from every ranking)."
                        : "All currently visible (rule is OFF)."}
                    </>
                  ) : (
                    <>No LP-pair strategies in the current index.</>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="uni-hub-section">
        <div className="rules-note rules-note-warn">
          <p className="rules-note-title">These switches are read-only</p>
          <p className="rules-note-body">
            The site is a static export, so rule state lives in code, not in a
            runtime store. To flip a rule, edit the constants at the top of{" "}
            <code className="rules-code">src/lib/admin-rules.ts</code>, commit,
            push to <code className="rules-code">main</code>. Vercel rebuilds
            and the new ruleset is live within a minute or two. The next
            hourly cron will pick up the change automatically. The &ldquo;Copy
            source path&rdquo; button on each rule pastes the file location to
            your clipboard so you can jump straight there.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div
        className="uni-hub-stat-value"
        style={mono ? undefined : { fontSize: 15, fontWeight: 500 }}
      >
        {value}
      </div>
    </div>
  );
}
