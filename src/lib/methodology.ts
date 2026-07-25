import { SITE_URL } from "./constants";

export const METHODOLOGY_VERSION = {
  version: "1.1",
  date: "2026-07-25",
};

export interface MethodologyChange {
  version: string;
  date: string;
  summary: string;
}

export const METHODOLOGY_CHANGELOG: MethodologyChange[] = [
  {
    version: "1.0",
    date: "2026-05-03",
    summary: "Initial methodology published. Covers APY calculation, TVL, ranking, consistency scoring, inclusion criteria, data sources, limitations, and disclosure.",
  },
  {
    version: "1.1",
    date: "2026-07-25",
    summary: "Published formal inclusion criteria for third-party (non-Harvest-operated) venues, as committed to in v1.0. The index now covers third-party strategies on Polygon under those criteria, in addition to Harvest-operated strategies. Scope, data-sources, limitations and disclosure sections updated accordingly.",
  },
];

export const METHODOLOGY_URL = `${SITE_URL}/methodology`;
