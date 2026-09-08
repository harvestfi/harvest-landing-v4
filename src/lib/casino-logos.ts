import type { StaticImageData } from "next/image";

import sevenBit from "../7bit casino.png";
import bcGame from "../bcgame.png";
import betfury from "../betfury.png";
import betninja from "../betninja.png";
import betpanda from "../betpanda.png";
import betplay from "../betplay.png";
import blockSpins from "../assets/icons/blockspins.png";
import casinoPunkz from "../casino punkz.png";
import coinCasino from "../coincasino.png";
import cryptoGames from "../assets/icons/crypto games.png";
import cryptorino from "../cryptorino.png";
import cybet from "../cybet casino.png";
import goldenPanda from "../goldenpanda.png";
import hyperLucky from "../hyperlucky.png";
import luckyBlock from "../luckyblock.png";
import luckyRollers from "../luckyrollers.png";
import thrill from "../thrillcasino.png";
import wave from "../wave casino.png";
import wildIo from "../wild io.png";
import wsm from "../wsm-casino.png";

export const CASINO_LOGOS: Record<string, StaticImageData> = {
  "7bit-casino": sevenBit,
  "bc-game": bcGame,
  betfury,
  betninja,
  "betpanda-io": betpanda,
  "betplay-io": betplay,
  "block-spins": blockSpins,
  casinopunkz: casinoPunkz,
  "coin-casino": coinCasino,
  "crypto-games": cryptoGames,
  cryptorino,
  cybet,
  "golden-panda": goldenPanda,
  "hyper-lucky": hyperLucky,
  "lucky-block": luckyBlock,
  "lucky-rollers": luckyRollers,
  thrill,
  vave: wave,
  "wild-io": wildIo,
  "wsm-casino": wsm,
};

export const LOGO_RATIO = 1619 / 686;

export function hasLogo(slug: string): boolean {
  return slug in CASINO_LOGOS;
}
