/**
 * Spot price for an Ethereum token, priced from CoinMarketCap's DEX data.
 *
 * The ticker-based `crypto` menu cannot reach a token like this: it has no
 * CoinGecko coin id, so the price is looked up by contract address instead.
 */

import chalk from "chalk";
import { Effect } from "effect";
import { CoinMarketCapDexModel } from "../../../model/index.ts";
import {
  CommandResultType,
  type CommandState,
  TerminalUserStateConfigContext,
} from "../../../../types.ts";
import type { ProgramError } from "../../../../errors/index.ts";
import { boldCell, greenCell, redCell } from "../../../../utils/table_markup.ts";
import { table } from "../../../../utils/table.ts";
import { formatCompactUsd, formatSignedPct, formatUsd } from "../../../../utils/format.ts";
import { dexTokenLabel, shortAddress } from "../../types.ts";
import { ADDRESS_USAGE, addressProblem, resolveEthereumToken } from "./token.ts";

/** Colour a 24-hour change by sign, as a table cell. */
const changeCell = (pct: number | undefined): string => {
  const label = formatSignedPct(pct);
  if (pct === undefined) return label;
  return pct >= 0 ? greenCell(label) : redCell(label);
};

/**
 * Print the current price and the day's activity for one Ethereum token.
 */
export const dexSpotHandler = (
  addressStr?: string,
): Effect.Effect<
  CommandState,
  ProgramError,
  CoinMarketCapDexModel | TerminalUserStateConfigContext
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    const token = resolveEthereumToken(st, addressStr);
    if (!token) {
      console.log(chalk.red(addressProblem(addressStr)));
      console.log(chalk.dim(ADDRESS_USAGE));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    yield* Effect.logInfo(`Fetching DEX spot for ${token.address}`);

    const model = yield* CoinMarketCapDexModel;
    const spot = yield* model.token.get(token, st.apiKeys.coinmarketcap);

    const label = dexTokenLabel(spot.token);
    const name = spot.token.name;
    const heading = name && name !== label ? `${label} — ${name}` : label;

    // `0x…` is shown whole: a truncated contract address is unusable for the
    // copy-and-check that is the first thing anyone does with one.
    const range = spot.low24h === undefined || spot.high24h === undefined
      ? "n/a"
      : `${formatUsd(spot.low24h)} – ${formatUsd(spot.high24h)}`;

    console.log("");
    console.log(chalk.bold(heading));
    console.log("");

    table(
      [
        ["Field", "Value"],
        ["Price", greenCell(formatUsd(spot.price))],
        ["24h Change", changeCell(spot.change24hPct)],
        ["24h Volume", formatCompactUsd(spot.volume24hUsd)],
        ["Market Cap", formatCompactUsd(spot.marketCapUsd)],
        ["Liquidity", formatCompactUsd(spot.liquidityUsd)],
        ["24h Range", range],
        ["Decimals", spot.decimals === undefined ? "n/a" : String(spot.decimals)],
        ["Platform", token.platform],
        ["Address", boldCell(token.address)],
      ],
      {
        hasBorder: true,
        contentHasMarkup: true,
        borderChars: "lightRounded",
        borderAttr: { color: "cyan" },
        textAttr: { bgColor: "default" },
        firstRowTextAttr: { bgColor: "cyan" },
        width: 120,
        fit: true,
      },
    );

    console.log(
      chalk.dim(`\nSource: CoinMarketCap DEX · ${shortAddress(token.address)}`),
    );
    console.log("");

    yield* Effect.logDebug(`Fetched DEX spot for ${label}`);

    return { result: { type: CommandResultType.Success }, state: st };
  });
