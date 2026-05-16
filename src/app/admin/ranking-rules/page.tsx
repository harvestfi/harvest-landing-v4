import { getVaults } from "@/lib/data";
import {
  RANKING_RULES,
  isAerodromeName,
  HIDE_AERODROME,
} from "@/lib/admin-rules";
import { RuleStateBadge } from "@/components/admin/rule-state-badge";

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
    aerodromeMatches: vaults.filter((v) => isAerodromeName(v.productName, v.category)).length,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Ranking Rules
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Editorial filters applied to every public ranking surface
          (homepage, asset hubs, network hubs, related vaults, ticker
          strip, sitemap). Rules are configuration-as-code: flipping
          a switch requires a commit and a rebuild.
        </p>
      </header>

      <section className="space-y-4">
        {RANKING_RULES.map((rule) => (
          <article
            key={rule.id}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900">
                  {rule.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {rule.rationale}
                </p>
                <p className="mt-3 font-mono text-xs text-gray-400">
                  {rule.source}
                </p>
              </div>
              <RuleStateBadge enabled={rule.enabled} source={rule.source} />
            </div>

            {rule.id === "hide-aerodrome" && (
              <div className="mt-4 rounded-md bg-gray-50 px-4 py-3 text-xs text-gray-600">
                {totals.aerodromeMatches > 0 ? (
                  <>
                    Currently matching{" "}
                    <strong>{totals.aerodromeMatches}</strong> of{" "}
                    {totals.all} indexed vaults.{" "}
                    {HIDE_AERODROME
                      ? "All hidden from public surfaces."
                      : "All currently visible (rule is OFF)."}
                  </>
                ) : (
                  <>No Aerodrome strategies in the current index.</>
                )}
              </div>
            )}
          </article>
        ))}
      </section>

      <footer className="mt-10 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">These switches are read-only</p>
        <p className="mt-2">
          The site is a static export, so rule state lives in code,
          not in a runtime store. To flip a rule, edit the
          constants at the top of{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
            src/lib/admin-rules.ts
          </code>
          , commit, push to <code className="font-mono">main</code>.
          Vercel rebuilds and the new ruleset is live within a minute
          or two. The next hourly cron will pick up the change
          automatically. The &ldquo;Copy source path&rdquo; button on
          each rule pastes the file location to your clipboard so
          you can jump straight there.
        </p>
      </footer>
    </main>
  );
}

