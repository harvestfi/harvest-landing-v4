import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hasLogo } from "@/lib/casino-logos";
import { capOf, parseBonus, type Casino, type CasinoData } from "@/lib/crypto-casinos";

export function isRanked(c: Casino): boolean {
  return hasLogo(c.slug) && Boolean(c.url);
}

export function loadCasinos(): CasinoData {
  try {
    const f = join(process.cwd(), "data", "crypto-casinos.json");
    if (!existsSync(f)) return { generatedAt: null, casinos: [] };
    const d = JSON.parse(readFileSync(f, "utf-8")) as CasinoData;
    const casinos = (Array.isArray(d.casinos) ? d.casinos : []).filter(
      (c: Casino) => c && c.slug && c.name,
    );
    casinos.sort((a, b) => {
      const ua = capOf(a);
      const ub = capOf(b);
      if (ua != null && ub != null) return ub - ua || a.order - b.order;
      if (ua != null) return -1;
      if (ub != null) return 1;
      const pa = parseBonus(a.bonusClaim).pct ?? -1;
      const pb = parseBonus(b.bonusClaim).pct ?? -1;
      return pb - pa || a.order - b.order;
    });
    return { generatedAt: d.generatedAt ?? null, casinos };
  } catch {
    return { generatedAt: null, casinos: [] };
  }
}
