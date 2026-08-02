// The site's single named author entity, per the E-E-A-T requirement in the
// stablecoin report build spec: every isBasedOn on the site points at
// /methodology and /risk-framework, and until now neither carried a named
// author. A stable team-level pseudonym rather than an invented human persona;
// rename here and every schema surface follows.

import { SITE_URL } from "./constants";

export const SITE_AUTHOR = {
  name: "Harvest Research",
  url: `${SITE_URL}/about`,
} as const;
