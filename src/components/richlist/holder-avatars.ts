// Logos for the named holders in the /xrp-rich-list ranking.
//
// Keyed by the label's `name` exactly as it appears in
// data/xrpl-account-labels.json, because that is the string the badge
// renders and the only thing the two files agree on. A name with no entry
// here renders a badge with no avatar, which is the correct outcome for an
// operator nobody has a mark for rather than something to fall back from.
//
// Static imports rather than a filename built at runtime: `output: "export"`
// fingerprints these at build time, so a path assembled from data would 404.
// It also means a renamed or deleted file fails the build instead of shipping
// a broken image into the one table this page is named for.
//
// Two label entries share one mark. Binance's main wallet and its XRP-BF2
// reserve are the same venue, so they carry the same logo.

import type { StaticImageData } from "next/image";

import binance from "@/assets/icons/binance.png";
import bitgetGlobal from "@/assets/icons/Bitget Global.png";
import bitbank from "@/assets/icons/bitbank.png";
import bitflyer from "@/assets/icons/bitFlyer.png";
import bithumb from "@/assets/icons/bithumb.png";
import coincheck from "@/assets/icons/coincheck.png";
import coinone from "@/assets/icons/Coinone.png";
import cryptocom from "@/assets/icons/cryptocom.png";
import etoro from "@/assets/icons/etoro.png";
import ripple from "@/assets/icons/Ripple.png";
import upbit from "@/assets/icons/upbit.png";
import uphold from "@/assets/icons/uphold.png";
import ahbritto from "@/assets/icons/ahbritto.png";
import chrislarsen from "@/assets/icons/chrislarsen.png";

const HOLDER_AVATARS: Record<string, StaticImageData> = {
  Binance: binance,
  "Binance (XRP-BF2 Reserve)": binance,
  "Bitget Global": bitgetGlobal,
  Bithumb: bithumb,
  Coincheck: coincheck,
  Coinone: coinone,
  "Crypto.com": cryptocom,
  Ripple: ripple,
  UPbit: upbit,
  Uphold: uphold,
  ahbritto: ahbritto,
  bitFlyer: bitflyer,
  bitbank: bitbank,
  chrislarsen: chrislarsen,
  eToro: etoro,
};

/** The mark for a holder, or null when there is none for that name. */
export function holderAvatar(name: string | null | undefined): StaticImageData | null {
  if (!name) return null;
  return HOLDER_AVATARS[name] ?? null;
}
