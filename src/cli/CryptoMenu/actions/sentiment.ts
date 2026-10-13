/**
 * Market sentiment actions for the crypto menu.
 *
 * Both read a market-wide gauge from CoinMarketCap — no symbol, no address, no
 * arguments — and echo it as a small table:
 *
 *   fg      — Fear & Greed index (0-100)
 *   altcoin — Altcoin Season index (0-100)
 *
 * Handlers declare their dependency on the sentiment model; the crypto menu
 * provides `CryptoServiceLive`.
 */

import chalk from "chalk";
import { Effect } from "effect";
import { CoinMarketCapSentimentModel } from "../model/index.ts";
import {
  CommandResultType,
  type CommandState,
  TerminalUserStateConfigContext,
} from "../../types.ts";
import type { ProgramError } from "../../errors/index.ts";
import { boldCell } from "../../utils/table_markup.ts";
import { table } from "../../utils/table.ts";
import { formatCompactUsd, toUtcLabel } from "../../utils/format.ts";

/** The table styling shared by both gauges. */
const sentimentTableOptions = {
  hasBorder: true,
  contentHasMarkup: true,
  borderChars: "lightRounded",
  borderAttr: { color: "cyan" },
  textAttr: { bgColor: "default" },
  firstRowTextAttr: { bgColor: "cyan" },
  width: 80,
  fit: true,
} as const;

/**
 * Print CoinMarketCap's Fear & Greed index: how greedy or fearful the market
 * is right now, on a 0-100 scale.
 */
export const fearGreedHandler = (): Effect.Effect<
  CommandState,
  ProgramError,
  CoinMarketCapSentimentModel | TerminalUserStateConfigContext
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const model = yield* CoinMarketCapSentimentModel;
    const index = yield* model.fearGreed.get(st.apiKeys.coinmarketcap);

    console.log("");
    console.log(chalk.bold("Crypto Fear & Greed Index"));
    console.log("");

    table(
      [
        ["Field", "Value"],
        ["Index", boldCell(String(index.value))],
        ["Sentiment", index.classification],
        ["Updated", toUtcLabel(index.updatedAt)],
      ],
      sentimentTableOptions,
    );

    console.log(
      chalk.dim("\n0 is extreme fear, 100 is extreme greed. Bands are CoinMarketCap's."),
    );
    console.log("");

    yield* Effect.logDebug(`Fetched fear & greed: ${index.value}`);

    return { result: { type: CommandResultType.Success }, state: st };
  });

/**
 * Print CoinMarketCap's Altcoin Season index: how altcoins are performing
 * against Bitcoin right now, on a 0-100 scale.
 */
export const altcoinSeasonHandler = (): Effect.Effect<
  CommandState,
  ProgramError,
  CoinMarketCapSentimentModel | TerminalUserStateConfigContext
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const model = yield* CoinMarketCapSentimentModel;
    const index = yield* model.altcoinSeason.get(st.apiKeys.coinmarketcap);

    const yearly = index.yearlyHigh === undefined || index.yearlyLow === undefined
      ? "n/a"
      : `${index.yearlyLow}${index.yearlyLowDate ? ` (${index.yearlyLowDate})` : ""} – ` +
        `${index.yearlyHigh}${index.yearlyHighDate ? ` (${index.yearlyHighDate})` : ""}`;

    console.log("");
    console.log(chalk.bold("Altcoin Season Index"));
    console.log("");

    table(
      [
        ["Field", "Value"],
        ["Index", boldCell(String(index.index))],
        ["Altcoin Market Cap", formatCompactUsd(index.marketCapUsd)],
        ["Snapshot", toUtcLabel(index.snapshotTime)],
        ["Yearly Range", yearly],
      ],
      sentimentTableOptions,
    );

    console.log(
      chalk.dim("\n0-100: the higher the index, the more the market is led by altcoins."),
    );
    console.log("");

    yield* Effect.logDebug(`Fetched altcoin season index: ${index.index}`);

    return { result: { type: CommandResultType.Success }, state: st };
  });
