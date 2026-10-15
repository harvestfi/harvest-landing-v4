import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { SITE_AUTHOR } from "@/lib/author";
import { AssetIcon } from "@/components/token-icons";
import richListHeader from "@/assets/icons/XRP Rich List Header.png";
import {
  breadcrumbSchema,
  faqPageSchema,
  reportDatasetSchema,
  reportWebPageSchema,
} from "@/lib/jsonld";
import { PercentileCalculator } from "@/components/richlist/percentile-calculator";
import { TopAccountsTable } from "@/components/richlist/top-accounts-table";
import { AvatarStack } from "@/components/richlist/avatar-stack";
import { holderAvatar } from "@/components/richlist/holder-avatars";
import {
  DistributionChart,
  DistributionTable,
} from "@/components/richlist/distribution-chart";
import { HtmlLang } from "@/components/html-lang";
import { loadRichList, accountsAtOrAbove, tierOf } from "@/lib/xrp-richlist";
import {
  koDate,
  koTime,
  koStamp,
  koCount,
  koXrp,
  koWon,
  koPct,
  koName,
  josa,
  KOREAN_EXCHANGES,
} from "@/lib/xrp-richlist-ko";
import "../../_styles/home.css";
import "../../_styles/xrp-staking-calc.css";
import "../../_styles/report.css";
import "../../_styles/rich-list.css";

// /ko/xrp-rich-list: the Korean edition of /xrp-rich-list.
//
// Same snapshot, same calculator, same ranking; the figures cannot disagree
// with the English page because both read data/xrp-richlist.json at build
// time. What differs is what a Korean reader needs that the English page does
// not carry:
//   - won values from Upbit's KRW-XRP price, because Korean XRP trades at its
//     own price and that is the figure a Korean holder checks against;
//   - a section on Korean exchanges, because UPbit is the largest exchange
//     holder in the whole ranking and Bithumb and Coinone are in it too;
//   - KST dates, 만/억/조 units and Korean names for the venues.
//
// Keyword choice, from Ahrefs (Google KR, 2026-10-15): the volume sits on
// 지갑 순위 / 보유 순위 ("wallet ranking"), not on 부자 or 리치리스트, which
// measured at or near zero. 리플 outranks XRP as the coin's name, so both are
// carried and 리플 leads. Naver's share of Korean search is not visible in
// that data, which is why the page also has to be registered with Naver
// Search Advisor rather than left to Google alone.
//
// Scope: the English page's yield, Larsen and threshold-history sections are
// not repeated. The yield report they link to is English-only, so one short
// bridge with a clearly labelled link is the honest version.

const PAGE_URL = `${SITE_URL}/ko/xrp-rich-list`;
const EN_URL = `${SITE_URL}/xrp-rich-list`;

// This route's first publication. Fixed, for the reason recorded on the
// English page: a published date that moves with every snapshot makes a
// maintained page look republished.
const PUBLISHED_ISO = "2026-10-15T00:00:00.000Z";

// No live figures and no year, as on the English page, so nothing in the
// snippet goes stale. 지갑 순위 leads because it is the measured term; 부자,
// 고래 and 상위 1% follow because they are the community's words for the same
// question, as a Korean-speaking member of the team put it.
const TITLE = "리플(XRP) 지갑 순위: 부자·고래 순위와 상위 1% 계산기";
const DESCRIPTION =
  "XRP 레저에서 직접 읽은 리플(XRP) 보유량 순위. 상위 1%·10% 기준 수량, 고래 지갑, 업비트·빗썸 보유량을 확인하고 내 XRP 순위를 계산해 보세요. 하루 4번 갱신됩니다.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    // No brand suffix, as on the English page: this page competes on query
    // match, not on masthead.
    title: { absolute: TITLE },
    description: DESCRIPTION,
    // hreflang both ways. The English page declares the same pair, and
    // x-default stays on English because it is the page most visitors
    // without a Korean locale should land on.
    alternates: {
      canonical: PAGE_URL,
      languages: { en: EN_URL, ko: PAGE_URL, "x-default": EN_URL },
    },
    openGraph: {
      type: "website",
      url: PAGE_URL,
      title: TITLE,
      description: DESCRIPTION,
      siteName: SITE_NAME,
      locale: "ko_KR",
      alternateLocale: ["en_US"],
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

function Check() {
  return (
    <svg
      className="rl-check"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Crumbs() {
  return (
    <nav className="rp-crumbs" aria-label="Breadcrumb">
      <Link href="/">{SITE_NAME}</Link>
      <span className="sep">/</span>
      <span>리플(XRP) 리치리스트</span>
    </nav>
  );
}

export default function XrpRichListKoPage() {
  const data = loadRichList();

  if (!data) {
    return (
      <div className="uni-home-test rp-page rl-page" lang="ko">
        <HtmlLang lang="ko" />
        <Crumbs />
        <section className="uni-home-hero">
          <div className="uni-home-hero-inner">
            <h1 className="uni-home-h1">리플(XRP) 리치리스트</h1>
            <p className="rp-lead">
              이 페이지의 XRP 레저 스냅샷을 다시 만드는 중입니다. 다음 레저 조회가
              끝나면 최신 수치가 다시 표시됩니다.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const snap = data.ledgerCloseIso;
  const snapDate = koDate(snap);
  const snapStamp = koStamp(snap);
  const krw = data.xrpKrw ?? null;
  const won = (xrp: number) => (krw ? koWon(xrp * krw) : null);
  const share2 = (v: number) => `${v.toFixed(2)}%`;
  const ranked = data.top.length;

  const t1 = tierOf(data, 1);
  const t10 = tierOf(data, 10);
  const t50 = tierOf(data, 50);

  const bandsAtOrAbove = (min: number) =>
    data.bands.filter((b) => b.min >= min).reduce((n, b) => n + b.accounts, 0);
  const millionPlus = bandsAtOrAbove(1e6);
  const tenMillionPlus = bandsAtOrAbove(1e7);
  const under1000Pct = data.bands
    .filter((b) => b.max != null && b.max <= 1_000)
    .reduce((a, b) => a + b.pctOfAccounts, 0);
  const under1000XrpPct = data.bands
    .filter((b) => b.max != null && b.max <= 1_000)
    .reduce((a, b) => a + b.pctOfXrp, 0);
  const whalePctAccounts = data.bands
    .filter((b) => b.min >= 1e6)
    .reduce((n, b) => n + b.pctOfAccounts, 0);
  const whalePctXrp = data.bands
    .filter((b) => b.min >= 1e6)
    .reduce((n, b) => n + b.pctOfXrp, 0);

  // Exchanges, grouped on the bare venue name, the same rule the English page
  // uses, so "Binance" and "Binance (XRP-BF2 Reserve)" are one venue.
  const exchangeRows = data.top.filter((a) => a.label?.type === "exchange");
  const exchangeAccounts = exchangeRows.length;
  const exchangeXrp = exchangeRows.reduce((n, a) => n + a.xrp, 0);
  const exchangeRanking = Object.entries(
    exchangeRows.reduce<Record<string, { xrp: number; accounts: number }>>((acc, a) => {
      const name = (a.label?.name ?? "").replace(/\s*\(.*\)\s*$/, "").trim();
      if (!name) return acc;
      acc[name] = acc[name] ?? { xrp: 0, accounts: 0 };
      acc[name].xrp += a.xrp;
      acc[name].accounts += 1;
      return acc;
    }, {}),
  )
    .map(([name, v]) => ({ name, ...v }))
    .sort((x, y) => y.xrp - x.xrp);
  const koreanExchanges = exchangeRanking.filter((e) => KOREAN_EXCHANGES.has(e.name));
  const koreanXrp = koreanExchanges.reduce((n, e) => n + e.xrp, 0);
  const koreanAccounts = koreanExchanges.reduce((n, e) => n + e.accounts, 0);
  const largestExchange = exchangeRanking[0] ?? null;

  const rippleRows = data.top.filter((a) => a.label?.affiliation === "ripple");
  const rippleXrp = rippleRows.reduce((n, a) => n + a.xrp, 0);
  const rippleEscrow = rippleRows.reduce((n, a) => n + (a.escrowedXrp ?? 0), 0);
  const ripplePct = data.xrpHeld > 0 ? (rippleXrp / data.xrpHeld) * 100 : 0;

  const labelled = data.top.filter((t) => t.label);
  const burned = data.totalSupplyXrp ? 1e11 - data.totalSupplyXrp : null;

  const exact = (k: string) => data.exactCounts[k] ?? 0;
  const millionaireXrp = krw ? 1e9 / krw : null; // 10억 원
  const millionaireAccounts =
    millionaireXrp != null ? Math.round(accountsAtOrAbove(data.ladder, millionaireXrp)) : null;

  // Every answer carries its own date, as on the English page: an answer
  // lifted out of the page has to stay true on its own.
  const faqs = [
    {
      q: "리플(XRP) 지갑 순위는 어디서 볼 수 있나요?",
      a: `이 페이지에서 볼 수 있습니다. XRP 레저는 누구나 조회할 수 있는 공개 원장이라, 이 페이지는 ${snapStamp}에 마감된 레저 ${koCount(data.ledgerIndex)}번의 모든 지갑 ${koCount(data.accounts)}개를 직접 읽고 각 지갑이 보유한 XRP 수량으로 순위를 매깁니다. 상위 ${koCount(ranked)}개 지갑은 아래 표에 하나씩 나와 있고, 나머지 지갑은 보유량 구간별 분포 차트에서 확인할 수 있습니다.`,
    },
    {
      q: "XRP 상위 1%가 되려면 몇 개가 필요한가요?",
      a: t1
        ? `${snapDate} 기준으로 XRP를 ${koCount(t1.minXrp)}개 이상 보유하면 XRP 레저 전체 지갑 중 상위 1%에 들었습니다. 상위 1% 지갑들은 같은 날 기준 전체 XRP의 ${koPct(t1.pctOfXrp)}를 보유하고 있었습니다.`
        : "",
    },
    {
      q: "XRP 상위 10%가 되려면 몇 개가 필요한가요?",
      a:
        t10 && t50
          ? `${snapDate} 기준으로 ${koCount(t10.minXrp)} XRP 이상이면 상위 10%였고, 상위 50%의 기준은 ${koXrp(t50.minXrp)} XRP에 불과했습니다. 대부분의 지갑이 아주 적은 양만 보유하고 있기 때문에, 많은 보유자가 예상보다 높은 순위에 들어갑니다.`
          : "",
    },
    {
      q: "리플 1000개면 많은 건가요?",
      a: `${snapDate} 기준으로 XRP를 1,000개 이상 가진 지갑은 전체 ${koCount(data.accounts)}개 중 ${koCount(exact("1000"))}개였습니다. 즉 1,000개를 보유하면 전체 지갑의 ${koPct(100 - (exact("1000") / data.accounts) * 100)}보다 많이 가진 셈입니다${
        krw ? `. 업비트 시세 ${koCount(krw)}원 기준으로 1,000 XRP는 약 ${koWon(1000 * krw)}입니다` : ""
      }.`,
    },
    {
      q: "리플 1만 개 이상 가진 사람은 몇 명인가요?",
      a: `${snapDate} 기준으로 XRP를 10,000개 이상 보유한 지갑은 ${koCount(exact("10000"))}개로, 전체 지갑의 ${koPct((exact("10000") / data.accounts) * 100)}였습니다. 같은 날 기준 10만 개 이상은 ${koCount(exact("100000"))}개, 100만 개 이상은 ${koCount(exact("1000000"))}개 지갑이었습니다. 다만 지갑 수는 사람 수가 아니므로, 한 사람이 여러 지갑을 가질 수도 있고 거래소 지갑 하나에 수많은 고객의 XRP가 들어 있을 수도 있습니다.`,
    },
    {
      q: "XRP 고래의 기준은 무엇인가요?",
      a: millionPlus
        ? `공식 기준은 없습니다. 흔히 100만 XRP 이상 보유한 지갑을 고래라고 부르는데, ${snapDate} 기준으로 이런 지갑은 ${koCount(millionPlus)}개(전체의 ${koPct(whalePctAccounts)})였고 전체 XRP의 ${koPct(whalePctXrp)}를 보유하고 있었습니다. 1,000만 XRP 이상을 가진 이른바 대왕고래 지갑은 같은 날 기준 ${koCount(tenMillionPlus)}개였습니다.`
        : "",
    },
    {
      q: "리플로 10억 원을 만들려면 몇 개가 필요한가요?",
      a:
        krw && millionaireXrp != null && millionaireAccounts != null
          ? `업비트 시세 ${koCount(krw)}원 기준으로 10억 원어치는 약 ${koCount(millionaireXrp)} XRP입니다(${snapDate}). 같은 날 기준 이 수량 이상을 보유한 지갑은 약 ${koCount(millionaireAccounts)}개로, 전체 지갑의 ${koPct((millionaireAccounts / data.accounts) * 100)}였습니다. 필요한 수량은 시세에 따라 매일 달라집니다.`
          : "",
    },
    {
      q: "XRP 지갑은 모두 몇 개인가요?",
      a: `${snapDate} 기준으로 XRP 레저에는 활성화된 지갑이 ${koCount(data.accounts)}개 있었습니다. XRP 레저 지갑은 기본 준비금(1 XRP)을 보유해야 존재할 수 있으므로, 이 숫자에 포함된 모든 지갑에는 잔액이 있습니다.`,
    },
    {
      q: "XRP를 가장 많이 보유한 거래소는 어디인가요?",
      a: largestExchange
        ? `${snapDate} 기준으로 이 순위에서 XRP를 가장 많이 보유한 거래소는 ${josa(koName(largestExchange.name), "으로/로")}, ${largestExchange.accounts}개 지갑에 ${koXrp(largestExchange.xrp)} XRP${
            won(largestExchange.xrp) ? `(약 ${won(largestExchange.xrp)})` : ""
          }를 보유하고 있었습니다. 거래소 지갑은 고객들의 XRP를 모아 보관하는 곳이므로, 이 수치는 거래소 자체의 재산이 아니라 고객 예치금입니다.`
        : "",
    },
    {
      q: "리플사는 XRP를 얼마나 보유하고 있나요?",
      a: rippleRows.length
        ? `${snapDate} 기준으로 리플사는 상위 ${koCount(ranked)}개 지갑 중 ${rippleRows.length}개에 ${koXrp(rippleXrp)} XRP를 보유하고 있었고, 이는 전체 XRP의 ${koPct(ripplePct)}입니다. 이 중 ${koXrp(rippleEscrow)} XRP는 온체인 에스크로에 잠겨 있어 정해진 일정 전에는 움직일 수 없습니다. 리플 공동 창업자 개인 지갑은 이 수치에 포함되지 않습니다.`
        : "",
    },
    {
      q: "에스크로에 잠긴 XRP는 얼마나 되나요?",
      a: data.escrowedXrp
        ? `${snapDate} 기준으로 ${koCount(data.escrowedXrp)} XRP가 온체인 에스크로에 잠겨 있었고, 이는 전체 XRP의 ${share2((data.escrowedXrp / data.xrpHeld) * 100)}입니다${
            data.escrowObjects && data.escrowAccounts
              ? `. 이 물량은 ${koCount(data.escrowAccounts)}개 지갑의 에스크로 ${koCount(data.escrowObjects)}건에 나뉘어 있습니다`
              : ""
          }. 에스크로 물량은 레저에 기록된 해제일 전까지 사용할 수 없습니다.`
        : "",
    },
    {
      q: "지금까지 소각된 XRP는 얼마나 되나요?",
      a:
        burned != null && data.totalSupplyXrp
          ? `${snapDate} 기준으로 ${koCount(burned)} XRP가 거래 수수료로 소각되었습니다. 출시 때 발행된 1,000억 XRP와 같은 날 레저가 보고한 총 공급량 ${koCount(data.totalSupplyXrp)} XRP의 차이입니다. XRP 레저의 모든 거래는 소량의 수수료를 소각하고 새 XRP를 만드는 장치는 없기 때문에, 총량은 줄어들기만 합니다.`
          : "",
    },
    {
      q: "이 순위는 얼마나 자주 업데이트되나요?",
      a: `하루 4번 업데이트됩니다. 지금 보이는 수치는 ${snapStamp}에 마감된 레저 ${koCount(data.ledgerIndex)}번에서 읽은 것이며, 다음 조회가 끝나면 모든 숫자가 새 레저 기준으로 바뀝니다. 매번 하나의 검증된 레저 전체를 한 번에 읽기 때문에, 서로 다른 시점의 데이터가 섞이지 않습니다.`,
    },
  ].filter((f) => f.a);

  const crumbs = [
    { name: "홈", url: SITE_URL },
    { name: "리플(XRP) 리치리스트", url: PAGE_URL },
  ];

  return (
    <div className="uni-home-test rp-page rl-page" lang="ko">
      <HtmlLang lang="ko" />
      <Crumbs />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            ...(reportDatasetSchema({
              name: "XRP 레저 보유량 분포 데이터셋",
              description: `XRP 레저 ${koCount(data.ledgerIndex)}번 기준, 활성 지갑 ${koCount(data.accounts)}개의 보유량 분포, 상위 % 기준 수량, 구간별 지갑 수와 상위 ${ranked}개 지갑.`,
              url: PAGE_URL,
              dateModified: snap,
              numberOfItems: data.accounts,
              keywords: ["리플", "XRP", "지갑 순위", "부자 순위", "고래", "리치리스트"],
              sources: ["https://xrpl.org"],
              distribution: [
                { format: "application/json", url: `${SITE_URL}/data/xrp-rich-list/index.json` },
                { format: "text/csv", url: `${SITE_URL}/data/xrp-rich-list/distribution.csv` },
                { format: "text/csv", url: `${SITE_URL}/data/xrp-rich-list/thresholds.csv` },
                { format: "text/csv", url: `${SITE_URL}/data/xrp-rich-list/top-accounts.csv` },
              ],
            }) as Record<string, unknown>),
            inLanguage: "ko",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "리플(XRP) 지갑 순위 계산기",
            url: `${PAGE_URL}#calculator`,
            applicationCategory: "FinanceApplication",
            operatingSystem: "Any",
            browserRequirements: "Requires JavaScript for the balance lookup",
            description:
              "XRP 보유량을 입력하면 XRP 레저 전체 지갑 중 내 순위(상위 %)를 보여 줍니다. 지갑 연결이나 주소가 필요 없습니다.",
            inLanguage: "ko",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
            author: { "@type": "Organization", name: SITE_AUTHOR.name, url: SITE_AUTHOR.url },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            ...(reportWebPageSchema({
              name: "리플(XRP) 리치리스트",
              url: PAGE_URL,
              description: DESCRIPTION,
              datePublished: PUBLISHED_ISO,
              dateModified: snap,
            }) as Record<string, unknown>),
            inLanguage: "ko",
          }),
        }}
      />

      {/* ---------------------------------------------------------- hero */}
      <section className="rl-intro">
        <h1 className="uni-home-h1 rl-h1">리플(XRP) 리치리스트: 지갑 순위와 부자 순위 계산기</h1>
        <p className="rl-dateline">
          XRP 레저에서 직접 읽어 하루 4번 갱신합니다. 최신 스냅샷: {snapDate}{" "}
          {koTime(snap)}(한국시간).{" "}
          <Link href="/xrp-rich-list" hrefLang="en" lang="en">
            English
          </Link>
        </p>
        <Image src={richListHeader} alt="" className="rl-figure" sizes="100vw" priority />
        <p className="rl-figure-credit">
          헤더 이미지: 크리스 라슨 사진 RippleWorks 제공, 브래드 갈링하우스 및 기타 인물 사진
          출처 X.
        </p>

        <a href="#calculator-section" className="rl-figure-cta">
          계산기로 이동
          <span aria-hidden="true">↓</span>
        </a>

        <h2 className="rl-summary-h">요약</h2>
        <ul className="rl-keyfind">
          {data.top[0] ? (
            <li>
              {snapDate} 기준 XRP를 가장 많이 가진 지갑은{" "}
              <strong>{koXrp(data.top[0].xrp)} XRP</strong>를 보유하고 있었습니다
              {won(data.top[0].xrp) ? (
                <>
                  (약 <strong>{won(data.top[0].xrp)}</strong>)
                </>
              ) : null}
              .
            </li>
          ) : null}
          {t1 ? (
            <li>
              XRP 보유자 상위 1%에 들려면 {snapDate} 기준{" "}
              <strong>{koCount(t1.minXrp)} XRP</strong> 이상이 필요했습니다.
            </li>
          ) : null}
          {t10 && t50 ? (
            <li>
              상위 10% 기준은 <strong>{koCount(t10.minXrp)} XRP</strong>, 상위 50% 기준은{" "}
              <strong>{koXrp(t50.minXrp)} XRP</strong>였습니다({snapDate}).
            </li>
          ) : null}
          <li>
            {snapDate} 기준 XRP 레저의 활성 지갑은 <strong>{koCount(data.accounts)}개</strong>이며,
            이 지갑들이 {koXrp(data.xrpHeld)} XRP를 나눠 갖고 있습니다.
          </li>
          {largestExchange ? (
            <li>
              XRP를 가장 많이 보유한 거래소는 <strong>{koName(largestExchange.name)}</strong>
              {josa(koName(largestExchange.name), "으로/로").slice(koName(largestExchange.name).length)},{" "}
              {snapDate} 기준 <strong>{koXrp(largestExchange.xrp)} XRP</strong>
              {won(largestExchange.xrp) ? <>(약 {won(largestExchange.xrp)})</> : null}를
              보유하고 있었습니다.
            </li>
          ) : null}
          {koreanExchanges.length > 1 ? (
            <li>
              {koreanExchanges.map((e) => koName(e.name)).join("·")} 등 한국 거래소 지갑에는{" "}
              {snapDate} 기준 <strong>{koXrp(koreanXrp)} XRP</strong>가 있었습니다.
            </li>
          ) : null}
        </ul>
      </section>

      {/* ---------------------------------------------------- calculator */}
      <section
        id="calculator-section"
        className="rl-section rl-feature"
        aria-labelledby="calculator-title"
      >
        <div className="rl-feature-card">
          <div className="rl-feature-copy">
            <div className="rl-feature-head">
              <span className="rl-eyebrow-badge">
                <AssetIcon asset="XRP" size={16} decorative />
                계산기
              </span>
              <h2 id="calculator-title" className="rl-calc-title">
                리플(XRP) 부자 순위 계산기
              </h2>
              <p className="rl-calc-pitch-sub">
                내 XRP 보유량을 입력하면 전체 XRP 지갑 중 몇 %에 드는지 알려 드립니다.
              </p>
              <p className="rl-calc-pitch-sub">
                {`이 계산기는 지갑 주소나 지갑 연결, 로그인 없이 어떤 수량이든 ${snapDate} 기준 활성 지갑 ${koCount(data.accounts)}개와 비교합니다.`}
              </p>
            </div>

            <ul className="rl-checklist" data-lint="chrome">
              <li>
                <Check />
                <div>
                  <p>무료</p>
                  <p className="rl-checklist-sub">지갑 주소도, 지갑 연결도 필요 없습니다.</p>
                </div>
              </li>
              <li>
                <Check />
                <div>
                  <p>800만 개 이상의 XRP 지갑과 비교</p>
                  <p className="rl-checklist-sub">
                    XRP 지갑 {koCount(data.accounts)}개를 기준으로 계산합니다.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div id="calculator">
            <PercentileCalculator
              ladder={data.ladder}
              accounts={data.accounts}
              snapshotDate={snapDate}
              locale="ko"
              xrpKrw={krw}
            />
          </div>
        </div>
      </section>

      <section className="uni-home-content rl-jump" aria-labelledby="jump">
        <h2 id="jump" className="rl-sr">목차</h2>
        <nav className="rp-toc" aria-label="목차">
          <span className="rp-toc-label">목차</span>
          <a href="#calculator">계산기</a>
          <a href="#top-accounts">상위 {koCount(ranked)}</a>
          <a href="#thresholds">상위 % 기준</a>
          {koreanExchanges.length ? <a href="#korean-exchanges">한국 거래소</a> : null}
          <a href="#chart">분포</a>
          <a href="#ripple-holdings">리플사 보유량</a>
          <a href="#supply">공급량</a>
          <a href="#faq">자주 묻는 질문</a>
          <a href="#methodology">방법</a>
        </nav>
      </section>

      {/* ------------------------------------------------ top accounts */}
      <section className="uni-home-content rl-section" aria-labelledby="top-accounts">
        <p className="rp-eyebrow">고래 지갑</p>
        <h2 id="top-accounts">XRP 고래 지갑 순위: 보유량 상위 {koCount(ranked)}개 지갑</h2>
        <p className="rp-lead">
          {snapDate} 기준 XRP 보유량이 가장 많은 지갑 {koCount(ranked)}개를 레저{" "}
          {koCount(data.ledgerIndex)}번에서 읽어 순위를 매겼습니다
          {ranked > 100 ? ". 한 페이지에 100개씩 표시됩니다" : ""}.
        </p>
        <TopAccountsTable
          rows={data.top}
          snapshotDate={snapDate}
          xrpUsd={data.xrpUsd ?? null}
          locale="ko"
          xrpKrw={krw}
        />
        <p className="rl-note">
          {labelled.length > 0
            ? `${snapDate} 기준 순위에 오른 ${data.top.length}개 지갑 중 ${labelled.length}개에 보유자 이름이 붙어 있습니다.`
            : `${snapDate} 기준 순위에 오른 ${data.top.length}개 지갑 중 이름이 확인된 지갑은 없습니다.`}{" "}
          거래 패턴만으로 보유자를 추정하는 것은 추측에 불과하므로, 이 페이지는 출처를 보여 줄 수
          있는 경우에만 이름을 표시합니다.
        </p>
        <p className="rl-note">
          순위는 바로 쓸 수 있는 잔액과 온체인 에스크로에 잠긴 수량을 합친 기준입니다. 그래서
          쓸 수 있는 잔액이 수백 XRP뿐인 지갑도 상위에 오를 수 있습니다.
        </p>
        {krw ? (
          <p className="rl-note">
            원화 가치는 {snapDate} 업비트 KRW-XRP 시세 {koCount(krw)}원을 기준으로 계산했습니다.
            시세가 움직이면 원화 가치는 달라지지만 XRP 수량은 그대로입니다.
          </p>
        ) : data.xrpUsd ? (
          <p className="rl-note">
            원화 시세를 읽지 못해 이번에는 달러 가치({data.xrpUsd.toFixed(4)}달러, {snapDate},{" "}
            {data.xrpUsdSource})로 표시합니다.
          </p>
        ) : null}
      </section>

      {/* -------------------------------------------------- thresholds */}
      <section className="uni-home-content rl-section" aria-labelledby="thresholds">
        <p className="rp-eyebrow">보유량 순위</p>
        <h2 id="thresholds">XRP 상위 1%가 되려면 몇 개가 필요할까?</h2>
        <p className="rp-lead">
          {t1
            ? `${snapDate} 기준으로 XRP 레저 활성 지갑 중 상위 1%에 들려면 ${koCount(t1.minXrp)} XRP 이상이 필요했습니다.`
            : ""}
        </p>
        <p>
          {t10 && t50
            ? `상위 10%의 기준은 ${koCount(t10.minXrp)} XRP, 상위 50%의 기준은 ${koXrp(t50.minXrp)} XRP로 훨씬 낮습니다(${snapDate}). 대부분의 지갑이 아주 적은 양만 가지고 있기 때문에, 상위 1% 아래로 내려갈수록 기준 수량이 급격히 줄어듭니다.`
            : ""}
        </p>

        <div className="rl-dtable-wrap" data-nosnippet="">
          <table className="rl-dtable rl-tiers">
            <caption className="rl-dtable-cap">
              {snapDate} 기준 XRP 보유량 상위 % 기준 수량
            </caption>
            <thead>
              <tr>
                <th scope="col">상위 %</th>
                <th scope="col">최소 보유량(XRP)</th>
                <th scope="col">해당 지갑 수</th>
                {krw ? <th scope="col">원화 환산</th> : null}
                <th scope="col">누적 XRP 비중</th>
              </tr>
            </thead>
            <tbody>
              {data.tiers.map((t) => (
                <tr key={t.pct}>
                  <th scope="row">상위 {t.pct}%</th>
                  <td className="rl-num" data-label="최소 보유량">{koCount(t.minXrp)}</td>
                  <td className="rl-num" data-label="해당 지갑 수">{koCount(t.accounts)}</td>
                  {krw ? (
                    <td className="rl-num" data-label="원화 환산">{koWon(t.minXrp * krw)}</td>
                  ) : null}
                  <td className="rl-num" data-label="누적 XRP 비중">{koPct(t.pctOfXrp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rl-note">
          각 구간은 위 구간을 포함합니다. 예를 들어 상위 1%에는 상위 0.1%가 들어 있어서, 누적
          비중은 아래로 갈수록 커집니다. 기준 수량은 모든 지갑 잔액의 히스토그램에서 읽으며,{" "}
          {snapDate} 기준 오차는 최대 {data.method.thresholdRelativeErrorPct}%입니다.
        </p>
      </section>

      {/* ------------------------------------------- Korean exchanges
          The section the English page does not need. UPbit is the largest
          exchange holder in the whole ranking, and a Korean reader asking who
          holds XRP is mostly asking about the venues they use. */}
      {koreanExchanges.length ? (
        <section className="uni-home-content rl-section" aria-labelledby="korean-exchanges">
          <p className="rp-eyebrow">한국 거래소</p>
          <h2 id="korean-exchanges">업비트·빗썸·코인원의 XRP 보유량</h2>
          <p className="rp-lead">
            {`${snapDate} 기준으로 한국 거래소 지갑 ${koreanAccounts}개에 ${koXrp(koreanXrp)} XRP가 있었고, 이는 전체 XRP의 ${koPct((koreanXrp / data.xrpHeld) * 100)}입니다.`}
          </p>
          {largestExchange && KOREAN_EXCHANGES.has(largestExchange.name) ? (
            <p>
              {`${josa(koName(largestExchange.name), "은/는")} ${snapDate} 기준 전 세계 거래소 중 XRP를 가장 많이 보유한 곳으로, ${koXrp(largestExchange.xrp)} XRP를 보유해 ${exchangeRanking[1] ? `2위인 ${koName(exchangeRanking[1].name)}(${koXrp(exchangeRanking[1].xrp)} XRP)보다 ${(largestExchange.xrp / exchangeRanking[1].xrp).toFixed(1)}배 많았습니다` : "1위였습니다"}.`}
            </p>
          ) : null}
          <div className="rl-dtable-wrap" data-nosnippet="">
            <table className="rl-dtable">
              <caption className="rl-dtable-cap">
                {snapDate} 기준 거래소별 XRP 보유량(상위 {koCount(ranked)}개 지갑 기준)
              </caption>
              <thead>
                <tr>
                  <th scope="col">거래소</th>
                  <th scope="col">보유 XRP</th>
                  {krw ? <th scope="col">원화 환산</th> : null}
                  <th scope="col">지갑 수</th>
                  <th scope="col">전체 XRP 중 비중</th>
                </tr>
              </thead>
              <tbody>
                {exchangeRanking.slice(0, 8).map((e) => (
                  <tr key={e.name}>
                    <th scope="row">
                      <span className="rl-breakdown-group">
                        {koName(e.name)}
                        {holderAvatar(e.name) ? <AvatarStack names={[e.name]} /> : null}
                      </span>
                    </th>
                    <td className="rl-num" data-label="보유 XRP">{koXrp(e.xrp)}</td>
                    {krw ? (
                      <td className="rl-num" data-label="원화 환산">{koWon(e.xrp * krw)}</td>
                    ) : null}
                    <td className="rl-num" data-label="지갑 수">{e.accounts}</td>
                    <td className="rl-num" data-label="비중">
                      {koPct(data.xrpHeld > 0 ? (e.xrp / data.xrpHeld) * 100 : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rl-note">
            거래소 지갑은 거래소 자신의 재산이 아니라 고객들이 맡긴 XRP를 모아 둔 곳입니다. 그래서
            거래소 보유량이 많다는 것은 그 거래소에 XRP를 맡긴 사람이 많다는 뜻입니다. 이름은
            제3자 데이터 제공자의 지갑 식별을 따르며, {snapDate} 기준 상위 {koCount(ranked)}개
            지갑 안에서 확인된 거래소 지갑 {exchangeAccounts}개(합계 {koXrp(exchangeXrp)} XRP)만
            집계했습니다. 순위 밖의 거래소 지갑은 포함되지 않으므로 실제 보유량은 이보다 많을 수
            있습니다.
          </p>
        </section>
      ) : null}

      {/* ------------------------------------------------------- chart */}
      <section className="uni-home-content rl-section" aria-labelledby="chart">
        <p className="rp-eyebrow">분포</p>
        <h2 id="chart">XRP 보유량 분포: 구간별 지갑 수</h2>
        <p className="rp-lead">
          XRP 레저 지갑 대부분은 아주 적은 양만 보유합니다. {snapDate} 기준 1,000 XRP 미만
          지갑이 전체의 {koPct(under1000Pct)}였고, 이 지갑들이 가진 XRP는 전체의{" "}
          {koPct(under1000XrpPct)}였습니다.
        </p>
        <div className="rl-chart-card">
          <div className="rl-chart-card-head">
            <div>
              <h3 className="rl-chart-card-title">XRP 보유자 비율 차트: 보유량 구간별 지갑 수</h3>
              <p className="rl-chart-card-desc">
                {snapDate} 기준 XRP 레저 활성 지갑 {koCount(data.accounts)}개
              </p>
            </div>
            <span className="rl-chart-legend">
              <span className="rl-chart-swatch" aria-hidden="true" />
              지갑 수
            </span>
          </div>
          <div className="rl-chart-card-body rl-chart-scroll">
            <DistributionChart
              bands={data.bands}
              snapshotDate={snapDate}
              totalAccounts={data.accounts}
              locale="ko"
            />
          </div>
        </div>
        <p className="rl-note">
          막대 높이는 제곱근 척도라서, 지갑이 수백 개인 구간도 수백만 개인 구간 옆에서 보입니다.
          정확한 수치는 막대 위 숫자와 아래 표에서 확인하세요.
        </p>

        <DistributionTable bands={data.bands} snapshotDate={snapDate} locale="ko" />
        <p className="rl-note">
          새우·게·물고기·돌고래·상어·고래·대왕고래는 보유자들이 흔히 쓰는 별칭이며 공식 기준은
          아닙니다. 각 구간은 하한 이상, 상한 미만이고 에스크로 물량을 포함합니다({snapDate}).
        </p>
      </section>

      {/* ------------------------------------------------- holders */}
      <section className="uni-home-content rl-section" aria-labelledby="how-many">
        <p className="rp-eyebrow">보유자</p>
        <h2 id="how-many">리플(XRP) 보유자는 몇 명일까?</h2>
        <p className="rp-lead">
          {`${snapDate} 기준 XRP 레저 활성 지갑은 ${koCount(data.accounts)}개지만, 이것이 XRP를 가진 사람 수는 아닙니다.`}
        </p>
        <p>
          한 사람이 여러 지갑을 만들 수 있으므로 지갑 수는 직접 XRP를 보관하는 사람 수보다
          많습니다. 반대로 업비트·빗썸 같은 거래소에 XRP를 맡긴 사람은 자기 지갑이 없으므로
          지갑 수에 잡히지 않습니다. {snapDate} 기준 이 순위에서 확인된 거래소 지갑{" "}
          {exchangeAccounts}개에만 {koXrp(exchangeXrp)} XRP가 고객 몫으로 들어 있었습니다.
        </p>
        <p>
          {`${snapDate} 기준 100만 XRP 이상 보유한 지갑은 ${koCount(millionPlus)}개였고, 그중 1,000만 XRP 이상은 ${koCount(tenMillionPlus)}개였습니다.`}
        </p>
      </section>

      {/* ------------------------------------------------ Ripple holdings */}
      <section className="uni-home-content rl-section" aria-labelledby="ripple-holdings">
        <p className="rp-eyebrow">리플사</p>
        <h2 id="ripple-holdings">리플사는 XRP를 얼마나 보유하고 있을까?</h2>
        <p className="rp-lead">
          {`${snapDate} 기준 리플사는 상위 ${koCount(ranked)}개 지갑 중 ${rippleRows.length}개에 ${koXrp(rippleXrp)} XRP${won(rippleXrp) ? `(약 ${won(rippleXrp)})` : ""}를 보유하고 있었고, 이는 전체 XRP의 ${koPct(ripplePct)}입니다.`}
        </p>
        <p>
          {`이 중 ${koXrp(rippleEscrow)} XRP는 온체인 에스크로에 잠겨 있고 나머지는 바로 쓸 수 있는 잔액입니다(${snapDate}). 리플사는 ${koCount(ranked)}위 밖의 운영 지갑에도 XRP를 갖고 있으므로, 이 수치는 리플사 전체 보유량이 아니라 순위 안에 든 부분입니다.`}
        </p>
        {data.concentration?.founderAccounts ? (
          <p className="rl-note">
            리플 공동 창업자(크리스 라슨, 아서 브리토 등)의 개인 지갑{" "}
            {data.concentration.founderAccounts}개는 회사가 통제하지 않으므로 리플사 보유량과
            따로 집계합니다. {snapDate} 기준 이 지갑들은{" "}
            {koXrp(data.concentration.founderXrp ?? 0)} XRP를 보유했습니다.
          </p>
        ) : null}
        {data.concentration?.ripplePctOfXrp != null ? (
          <div
            className="rl-breakdown"
            role="table"
            aria-label={`${snapDate} 기준 상위 100개 XRP 지갑의 보유자별 구성`}
          >
            <div className="rl-breakdown-head" role="row">
              <span role="columnheader">구분(상위 100개 지갑)</span>
              <span role="columnheader" className="rl-rank-n">지갑 수</span>
              <span role="columnheader" className="rl-rank-n">XRP</span>
              <span role="columnheader" className="rl-rank-n">전체 XRP 중 비중</span>
            </div>
            {[
              {
                k: "ripple",
                name: "리플사",
                n: data.concentration.rippleAccounts ?? 0,
                x: data.concentration.rippleXrp ?? 0,
                p: data.concentration.ripplePctOfXrp ?? 0,
              },
              {
                k: "exchange",
                name: "확인된 거래소",
                n: data.concentration.exchangeAccounts,
                x: data.concentration.exchangeXrp,
                p: data.concentration.top100PctOfXrp - data.concentration.exExchangePctOfXrp,
              },
              {
                k: "founder",
                name: "리플 창업자",
                n: data.concentration.founderAccounts ?? 0,
                x: data.concentration.founderXrp ?? 0,
                p: data.concentration.founderPctOfXrp ?? 0,
              },
              {
                k: "residual",
                name: "미확인 지갑",
                n: data.concentration.residualAccounts ?? 0,
                x: data.concentration.residualXrp ?? 0,
                p: data.concentration.residualPctOfXrp ?? 0,
              },
            ].map((g) => (
              <div className="rl-breakdown-row" role="row" key={g.k}>
                <span role="cell" className="rl-breakdown-group">{g.name}</span>
                <span role="cell" className="rl-rank-n">{g.n}</span>
                <span role="cell" className="rl-rank-n">{koXrp(g.x)}</span>
                <span role="cell" className="rl-rank-n">{share2(g.p)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* ----------------------------------------------------- supply */}
      {data.totalSupplyXrp ? (
        <section className="uni-home-content rl-section" aria-labelledby="supply">
          <p className="rp-eyebrow">공급량</p>
          <h2 id="supply">XRP 공급량: 유통량, 에스크로 물량, 소각량</h2>
          <p className="rp-lead">
            {snapDate} 기준 XRP 레저에는 {koCount(data.totalSupplyXrp)} XRP가 존재했습니다. 시세
            사이트가 아니라 레저 {koCount(data.ledgerIndex)}번의 총 공급량 값을 직접 읽은
            수치입니다.
          </p>
          <div className="rl-dtable-wrap" data-nosnippet="">
            <table className="rl-dtable">
              <caption className="rl-dtable-cap">{snapDate} 기준 XRP 레저 공급량</caption>
              <thead>
                <tr>
                  <th scope="col">항목</th>
                  <th scope="col">XRP</th>
                  <th scope="col">비중</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">레저 총 공급량</th>
                  <td data-label="XRP">{koCount(data.totalSupplyXrp)}</td>
                  <td data-label="비중">100%</td>
                </tr>
                {data.escrowedXrp != null ? (
                  <tr>
                    <th scope="row">에스크로 잠금 물량</th>
                    <td data-label="XRP">{koCount(data.escrowedXrp)}</td>
                    <td data-label="비중">
                      {share2((data.escrowedXrp / data.totalSupplyXrp) * 100)}
                    </td>
                  </tr>
                ) : null}
                {data.escrowedXrp != null ? (
                  <tr>
                    <th scope="row">유통량(에스크로 제외)</th>
                    <td data-label="XRP">{koCount(data.totalSupplyXrp - data.escrowedXrp)}</td>
                    <td data-label="비중">
                      {share2(
                        ((data.totalSupplyXrp - data.escrowedXrp) / data.totalSupplyXrp) * 100,
                      )}
                    </td>
                  </tr>
                ) : null}
                {burned != null ? (
                  <tr>
                    <th scope="row">출시 이후 수수료로 소각된 양</th>
                    <td data-label="XRP">{koCount(burned)}</td>
                    <td data-label="비중">{share2((burned / 1e11) * 100)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="rl-note">
            XRP는 2012년 출시 때 1,000억 개가 한 번에 발행되었고 더 만들 수 있는 방법이 없습니다.
            모든 거래가 소량의 수수료를 소각하기 때문에 총량은 줄어들기만 합니다. 시세 사이트의
            유통량은 보통 에스크로 물량을 뺀 수치이며, 에스크로 XRP는 레저에 기록된 해제일 전까지
            팔 수 없습니다.
          </p>
        </section>
      ) : null}

      {/* ----------------------------------------------------- bridge
          Short on purpose: the yield report it points to is English-only, and
          a Korean page that pretends otherwise costs the reader a click. */}
      <section className="uni-home-content rl-section" aria-labelledby="bridge">
        <div className="rl-bridge">
          <p className="rp-eyebrow">XRP 이자</p>
          <h2 id="bridge">XRP로 이자를 받을 수 있는 곳</h2>
          <p>
            XRP 레저에는 스테이킹이 없어서, XRP를 지갑에 보관만 해서는 이자가 붙지 않습니다. XRP로
            받는 수익은 모두 레저 밖의 다른 곳에서 나옵니다.
          </p>
          <ul className="rl-sources">
            {[
              {
                title: "렌딩 마켓",
                meta: "래핑된 XRP를 예치하고 대출자가 내는 이자를 받습니다. 이자율은 이용률에 따라 바뀝니다.",
              },
              {
                title: "볼트",
                meta: "전략이 포지션을 운용하며 수익을 복리로 쌓습니다.",
              },
              {
                title: "유동성 풀",
                meta: "XRP를 다른 자산과 짝지어 예치하고 거래 수수료와 보상을 받습니다.",
              },
              {
                title: "고정금리 상품",
                meta: "만기까지 이자율이 고정되며, 시장이 가격을 정합니다.",
              },
            ].map((r) => (
              <li className="rl-source" key={r.title}>
                <span className="rl-source-body">
                  <span className="rl-source-title">{r.title}</span>
                  <span className="rl-source-meta">{r.meta}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link className="rl-bridge-cta" href="/report/xrp-yield-ranking" hrefLang="en">
            XRP 수익률 순위 보기(영어)
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* -------------------------------------------------------- FAQ */}
      <section className="uni-home-content rl-section rl-faq-section" aria-labelledby="faq">
        <div className="rl-faq-head">
          <p className="rp-eyebrow">자주 묻는 질문</p>
          <h2 id="faq">리플(XRP) 지갑 순위 자주 묻는 질문</h2>
          <p className="rl-faq-desc">
            XRP 보유자 수와 순위 기준에 대해 자주 묻는 질문에 {snapDate} 레저 스냅샷으로
            답합니다.
          </p>
        </div>
        <div className="rl-faq">
          {faqs.map((f, i) => (
            <details className="rl-faq-item" name="rl-faq" key={f.q} open={i === 0}>
              <summary className="rl-faq-q">
                <span>{f.q}</span>
                <svg
                  className="rl-faq-chev"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="rl-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- methodology */}
      <section className="uni-home-content rl-section" aria-labelledby="methodology">
        <p className="rp-eyebrow">방법</p>
        <h2 id="methodology">이 리치리스트를 만드는 방법</h2>
        <dl className="rp-methodology-dl rl-method">
          <dt>출처</dt>
          <dd>
            검증된 XRP 레저 하나의 모든 계정(AccountRoot)을 공개 XRP 레저 노드에서 직접 읽습니다.
            {snapStamp}에 마감된 레저 {koCount(data.ledgerIndex)}번이 이 페이지 모든 수치의 유일한
            출처이며, 다른 리치리스트나 제3자 데이터는 쓰지 않습니다.
          </dd>
          <dt>순위 기준</dt>
          <dd>
            각 지갑이 통제하는 XRP, 즉 바로 쓸 수 있는 잔액과 온체인 에스크로에 잠긴 수량의
            합입니다.
          </dd>
          <dt>상위 % 계산</dt>
          <dd>
            잔액을 로그 간격 히스토그램(10배 구간당 {koCount(data.method.bucketsPerDecade)}칸)에
            모아 계산하며, {snapDate} 기준 각 기준 수량의 오차는 최대{" "}
            {data.method.thresholdRelativeErrorPct}%입니다. 1,000·10,000 XRP 같은 정수 기준의 지갑
            수는 히스토그램이 아니라 정확하게 셉니다.
          </dd>
          <dt>보유자 이름</dt>
          <dd>
            지갑이 온체인에 직접 공개한 도메인, 운영자가 공식 발표한 주소, 또는 이름이 밝혀진 데이터
            제공자의 식별처럼 근거를 보여 줄 수 있을 때만 이름을 붙입니다. 거래 패턴으로 보유자를
            추정하지 않습니다.
          </dd>
          <dt>원화 가치</dt>
          <dd>
            {krw
              ? `업비트 KRW-XRP 시세(${snapDate} 레저 조회 시점 ${koCount(krw)}원)를 곱해 계산합니다. 달러 시세를 환율로 바꾸지 않는 이유는 국내 거래소 XRP 가격이 해외와 다를 수 있기 때문입니다(김치 프리미엄).`
              : "원화 시세를 읽지 못한 스냅샷에서는 원화 가치를 표시하지 않습니다."}
          </dd>
          <dt>한계</dt>
          <dd>
            지갑은 사람이 아닙니다. 거래소는 수많은 고객의 XRP를 소수의 지갑에 보관하고, 한 사람이
            여러 지갑을 가질 수 있으므로 이 분포는 보유자가 아니라 지갑의 분포입니다. 다른
            네트워크로 래핑된 XRP처럼 XRP 레저 밖에 있는 물량은 포함되지 않습니다.
          </dd>
        </dl>
        <p className="rp-source-note">
          {SITE_AUTHOR.name} 발행. 이 페이지의 수치는 정보 제공용 자료이며 투자 조언이 아닙니다.{" "}
          <Link href="/xrp-rich-list" hrefLang="en">
            영어판 보기
          </Link>
        </p>
      </section>
    </div>
  );
}
