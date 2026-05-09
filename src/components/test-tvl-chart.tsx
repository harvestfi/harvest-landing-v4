// Pink bar chart used by the /test page hero. Lightweight: takes a
// (timestamp, value) series and renders a row of magenta bars whose
// heights are proportional to value/maxValue. Pure CSS heights, no
// canvas, no recharts; matches the chunky bar look from the public
// app.uniswap.org Pool detail page.

interface Props {
  series: { t: number; v: number }[];
}

export function TestTvlChart({ series }: Props) {
  if (series.length === 0) {
    return <div className="uni-chart uni-chart-empty">No data yet.</div>;
  }

  const maxV = Math.max(...series.map((p) => p.v), 0);
  const denom = maxV > 0 ? maxV : 1;

  const first = series[0];
  const last = series[series.length - 1];
  const tickFmt = (t: number) =>
    new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="uni-chart">
      <div className="uni-chart-bars">
        {series.map((p) => (
          <span
            key={p.t}
            className="uni-chart-bar"
            style={{ height: `${(p.v / denom) * 100}%` }}
            title={`${tickFmt(p.t)} · ${p.v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          />
        ))}
      </div>
      <div className="uni-chart-axis">
        <span>{tickFmt(first.t)}</span>
        <span>{tickFmt(last.t)}</span>
      </div>
    </div>
  );
}
