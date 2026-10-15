// Korean formatting for /ko/xrp-rich-list.
//
// Kept apart from xrp-richlist.ts so the English page's formatters stay
// byte-for-byte what they were. Everything here reads the same snapshot; only
// the way a number is written changes.
//
// Two conventions drive it. Korean counts large numbers in 만 (10^4), 억 (10^8)
// and 조 (10^12), so "6.43bn XRP" reads as "64.3억 XRP" and a won figure in the
// trillions is written as 조 and 억 rather than as a string of digits. And the
// reader's clock is KST: a snapshot closed at 23:30 UTC belongs to the next
// day in Seoul, so every date on the Korean page is a KST date, consistently,
// rather than a UTC date with a KST time next to it.

const KST = "Asia/Seoul";

const grouped = (n: number): string => Math.round(n).toLocaleString("en-US");

/** "2026년 10월 15일", in KST. */
export const koDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: KST,
  });

/** "20:28", 24-hour, in KST. */
export const koTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: KST,
  });

/** "2026년 10월 15일 20:28(한국시간)". */
export const koStamp = (iso: string): string => `${koDate(iso)} ${koTime(iso)}(한국시간)`;

/** Exact count with digit groups, the same as the English page's `count`. */
export const koCount = (n: number): string => grouped(n);

/** "823만", for prose where an exact count would be noise. */
export const koCountShort = (n: number): string =>
  n >= 10_000 ? `${grouped(n / 10_000)}만` : grouped(n);

/**
 * An XRP amount in Korean units. Below a million the digits are written out,
 * because a threshold like 43,702 XRP is a number a reader compares against
 * their own balance and rounding it to "4.4만" would take that away.
 */
export const koXrp = (n: number): string => {
  if (n >= 1e8) return `${(n / 1e8).toFixed(n >= 1e10 ? 0 : 1)}억`;
  if (n >= 1e6) return `${grouped(n / 1e4)}만`;
  if (n >= 1_000) return grouped(n);
  if (n >= 1) return (Math.round(n * 100) / 100).toLocaleString("en-US");
  return String(Math.round(n * 1e6) / 1e6);
};

/** A won amount: "약 1조 1,467억 원", "2억 3,000만 원", "178만 원". */
export const koWon = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return "0원";
  if (n >= 1e12) {
    let jo = Math.floor(n / 1e12);
    let eok = Math.round((n % 1e12) / 1e8);
    if (eok >= 10_000) {
      jo += 1;
      eok = 0;
    }
    return eok ? `${grouped(jo)}조 ${grouped(eok)}억 원` : `${grouped(jo)}조 원`;
  }
  if (n >= 1e8) {
    let eok = Math.floor(n / 1e8);
    let man = Math.round((n % 1e8) / 1e4 / 100) * 100;
    if (man >= 10_000) {
      eok += 1;
      man = 0;
    }
    return man ? `${grouped(eok)}억 ${grouped(man)}만 원` : `${grouped(eok)}억 원`;
  }
  if (n >= 1e4) return `${grouped(n / 1e4)}만 원`;
  return `${grouped(n)}원`;
};

/** Same thresholds as `pctLabel`, in Korean where it uses words. */
export const koPct = (v: number): string => {
  if (v >= 100) return "100%";
  if (v >= 99.95) return "99.9% 이상";
  if (v >= 99) return `${v.toFixed(1)}%`;
  if (v >= 10) return `${v.toFixed(0)}%`;
  if (v >= 1) return `${v.toFixed(1)}%`;
  if (v >= 0.01) return `${v.toFixed(2)}%`;
  return "0.01% 미만";
};

/**
 * Korean names for the holders a Korean reader knows by their Korean name.
 * The label registry keys stay untouched: the build gate checks them, and the
 * avatar lookup is keyed on them. This only changes what is printed.
 */
const KO_NAMES: Record<string, string> = {
  UPbit: "업비트",
  Bithumb: "빗썸",
  Coinone: "코인원",
  Korbit: "코빗",
  Binance: "바이낸스",
  bitbank: "비트뱅크",
  Coincheck: "코인체크",
  "Ripple company": "리플사",
  Ripple: "리플사",
  chrislarsen: "크리스 라슨",
  ahbritto: "아서 브리토",
};

/** Korean display name for a registry label, falling back to the label itself.
 *  A suffix in brackets ("Binance (XRP-BF2 Reserve)") is kept as written. */
export const koName = (name: string): string => {
  const m = name.match(/^(.*?)(\s*\(.*\))?$/);
  const base = (m?.[1] ?? name).trim();
  const rest = m?.[2] ?? "";
  return (KO_NAMES[base] ?? base) + rest;
};

/** Korean venues, so the page can total what Korean exchanges hold. */
export const KOREAN_EXCHANGES = new Set(["UPbit", "Bithumb", "Coinone", "Korbit", "Gopax"]);

/**
 * A name with its particle attached. Korean particles change form with the
 * last syllable (빗썸은 but 업비트는, 빗썸으로 but 업비트로), and the names here
 * come from data, so the form cannot be written into the copy.
 */
export const josa = (
  word: string,
  pair: "은/는" | "이/가" | "을/를" | "으로/로" | "과/와",
): string => {
  const [withFinal, without] = pair.split("/");
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  // Not a Hangul syllable (a Latin name such as "Crypto.com"): the vowel form
  // reads acceptably after most of them.
  if (code < 0 || code > 11171) return word + without;
  const final = code % 28;
  if (!final) return word + without;
  // ㄹ takes 로, not 으로: 서울로.
  if (pair === "으로/로" && final === 8) return word + without;
  return word + withFinal;
};
