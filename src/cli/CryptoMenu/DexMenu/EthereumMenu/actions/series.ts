/**
 * Series resolution for the Ethereum submenu.
 *
 * Both `chart` and the technical indicators need the same two things: a token's
 * candle series, and a human label to put on the chart. Candles carry no
 * symbol, so the token detail is fetched alongside them — one extra credit that
 * buys a title like `SNAP Price` instead of a 42-character address.
 */

import { Effect } from "effect";
import { CoinMarketCapDexModel } from "../../../model/index.ts";
import type { ProgramError } from "../../../../errors/index.ts";
import { type DexInterval, dexTokenLabel, type DexTokenType } from "../../types.ts";
import type { ChartData } from "src/services/CryptoService/types.ts";

export interface DexSeries {
  /** Display label for the token, e.g. `SNAP`. */
  label: string;
  /** The candle series, oldest first. */
  chart: ChartData;
}

/**
 * Fetch a token's label and candle series at `interval`.
 *
 * Fails when the token has no CoinMarketCap DEX record, which is also how a
 * token with no candles is reported.
 */
export const resolveDexSeries = (
  token: DexTokenType,
  apiKey: string | undefined,
  interval: DexInterval,
  limit?: number,
): Effect.Effect<DexSeries, ProgramError, CoinMarketCapDexModel> =>
  Effect.gen(function* () {
    const model = yield* CoinMarketCapDexModel;
    const spot = yield* model.token.get(token, apiKey);
    const chart = yield* model.candles.get(token, apiKey, interval, limit);
    return { label: dexTokenLabel(spot.token), chart };
  });
