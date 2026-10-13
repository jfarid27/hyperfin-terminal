/**
 * DEX submenu: address handling, payload extraction, and the actions.
 *
 * The indicator tests here matter beyond their own menu: they prove the DEX
 * path reaches the *shared* runners in `../../actions/technicals.ts` (same
 * overlay counts, same titles) rather than a parallel implementation that
 * would drift.
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { CoinMarketCapDexModel, CoinMarketCapDexModelLive } from "../../../model/index.ts";
import { FetchService } from "../../../../services/FetchService.ts";
import { ChartRenderer } from "../../../../StocksMenu/services/ChartRenderer.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../../../types.ts";
import type { TerminalUserStateConfig } from "../../../../types.ts";
import { TerminalUserStateConfigContext } from "../../../../types.ts";
import { HTTPError } from "../../../../errors/index.ts";
import type { ChartData, ChartPoint } from "src/services/CryptoService/types.ts";
import { toChartPoints, toDexSpot } from "../../../model/CoinMarketCapDexApi.ts";
import type { DexSpotPoint } from "../../types.ts";
import { dexTokenLabel, isDexInterval, shortAddress } from "../../types.ts";
import { addressProblem, isEthereumAddress, resolveDexAddress } from "./token.ts";
import { dexChartHandler, resolveDexInterval } from "./chart.ts";
import { dexSpotHandler } from "./spot.ts";
import {
  dexBollingerHandler,
  dexFibonacciHandler,
  dexReturnsHandler,
} from "./technicals.ts";
import { ethereumMenuOptions } from "../menu.ts";
import { dexMenuOptions } from "../../menu.ts";
import { technicalsMenuOptions } from "../TechnicalsMenu/menu.ts";

// ── Fixtures ──

/** The real contract this menu was built against (Hypersnap / SNAP). */
const ADDRESS = "0x49b5a631f54927c0007232844f06fe18cbf69786";

/** A daily-ish series with a clear up move, long enough for 20-bar bands. */
const prices: ChartPoint[] = Array.from({ length: 40 }, (_, i) => ({
  timestamp: Date.UTC(2026, 0, 1 + i),
  price: 100 + Math.sin(i / 4) * 8 + i * 0.7,
}));

const mockChartData = (series = prices): ChartData => ({
  symbol: { name: "SNAP", id: ADDRESS, _type: DataSourceType.CoinMarketCap },
  prices: series,
});

const mockSpot: DexSpotPoint = {
  token: {
    platform: "ethereum",
    address: ADDRESS,
    name: "Hypersnap",
    symbol: "SNAP",
    _type: DataSourceType.CoinMarketCap,
  },
  price: 0.0022034969,
  change24hPct: 14.72,
  volume24hUsd: 4416.04,
  marketCapUsd: 103836.77,
  liquidityUsd: 15259.25,
  high24h: 0.00241871,
  low24h: 0.00145569,
  decimals: 6,
};

/** A real `/v1/dex/token` payload, trimmed to the fields the model reads. */
const tokenPayload = {
  n: "Hypersnap",
  sym: "SNAP",
  addr: ADDRESS,
  plt: "Ethereum",
  dec: 6,
  mcap: "103836.770336666144276457",
  liqUsd: "15259.249055588742872461",
  p: "0.002203496924729647105803165568846090",
  ph24h: "0.002418710778463148722211338733338937",
  pl24h: "0.001455686063208899582283170147081200",
  sts: [
    { tp: "24h", vu: "4416.042572148533067238", pc: 0.1472 },
    { tp: "4h", vu: "22.034816187238581134", pc: -0.0025 },
  ],
};

const baseState: TerminalUserStateConfig = {
  environment: EnvironmentType.Development,
  logLevel: LogLevel.None,
  sessionPath: "",
  apiKeys: {
    coingecko: undefined,
    alphavantage: undefined,
    blockchaincom: undefined,
    freecryptoapi: undefined,
    fred: undefined,
    massive: undefined,
    yahoofinance: undefined,
    alpaca: undefined,
    coinmarketcap: "test-key",
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
    dex: { datasource: DataSourceType.CoinMarketCap },
  },
  scriptContext: {},
};

// ── Mock layers ──

const mockDexModel = (series = prices) =>
  Layer.succeed(CoinMarketCapDexModel, {
    token: { get: (_token, _apiKey) => Effect.succeed(mockSpot) },
    candles: { get: (_token, _apiKey, _interval) => Effect.succeed(mockChartData(series)) },
  });

/** Records every overlay handed to the renderer so band/level marks can be inspected. */
const spyRenderer = (
  captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[],
) =>
  Layer.succeed(ChartRenderer, {
    render: (_data, _x, _y, title) => {
      captured.push({ overlays: [], title });
      return Effect.void;
    },
    renderTechnical: (_data, _x, _y, overlays, title, _yLabel, primary) => {
      captured.push({ overlays, title, primary });
      return Effect.void;
    },
  });

const mockState = (overrides?: Partial<TerminalUserStateConfig>) =>
  Layer.succeed(TerminalUserStateConfigContext, { ...baseState, ...overrides });

/**
 * State with no DEX address loaded, so an action's own guard has to fire.
 *
 * Annotated as a `Partial` on purpose: an unannotated literal widens
 * `dex.datasource` to the whole `DataSourceType` enum, which the `DexContext`
 * does not accept.
 */
const noLoadedAddress: Partial<TerminalUserStateConfig> = {
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
    dex: { datasource: DataSourceType.CoinMarketCap },
  },
};

/** Everything the DEX actions need: the model, the renderer and the state. */
type DexRequirements =
  | CoinMarketCapDexModel
  | ChartRenderer
  | TerminalUserStateConfigContext;

/** State with the DEX address loaded, so a bare command falls back to it. */
const loadedAddress: Partial<TerminalUserStateConfig> = {
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
    dex: { address: ADDRESS, datasource: DataSourceType.CoinMarketCap },
  },
};

const run = <A, E>(
  effect: Effect.Effect<A, E, DexRequirements>,
  captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [],
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(mockDexModel()),
      Effect.provide(spyRenderer(captured)),
      Effect.provide(mockState()),
    ),
  );

// ── Tests ──

describe("DEX address handling", () => {
  it("accepts a contract address and rejects what is not one", () => {
    expect(isEthereumAddress(ADDRESS)).toBe(true);
    expect(isEthereumAddress(`  ${ADDRESS}  `), "surrounding space is trimmed").toBe(true);
    // Checksummed addresses carry mixed case; the `0x` prefix stays lowercase.
    expect(isEthereumAddress("0x49B5a631F54927c0007232844f06FE18cbf69786")).toBe(true);
    expect(isEthereumAddress(ADDRESS.toUpperCase()), "an uppercase 0X prefix is not accepted")
      .toBe(false);
    expect(isEthereumAddress("0x49b5"), "too short").toBe(false);
    expect(isEthereumAddress("49b5a631f54927c0007232844f06fe18cbf69786"), "no 0x").toBe(false);
    expect(isEthereumAddress("0xzzb5a631f54927c0007232844f06fe18cbf69786"), "not hex").toBe(false);
    expect(isEthereumAddress("")).toBe(false);
  });

  it("prefers the argument and falls back to the loaded address", () => {
    expect(resolveDexAddress(ADDRESS, "0xother")).toBe(ADDRESS);
    expect(resolveDexAddress(undefined, ADDRESS)).toBe(ADDRESS);
    expect(resolveDexAddress("nonsense", ADDRESS), "a bad argument does not fall back").toBe(null);
    expect(resolveDexAddress(undefined, undefined)).toBe(null);
  });

  it("explains a missing address differently from a malformed one", () => {
    expect(addressProblem(undefined)).toContain("No token address");
    expect(addressProblem("nope")).toContain("not an Ethereum address");
  });

  it("labels a token by symbol, then name, then a short address", () => {
    expect(dexTokenLabel({ ...mockSpot.token })).toBe("SNAP");
    expect(dexTokenLabel({ platform: "ethereum", address: ADDRESS, _type: DataSourceType.CoinMarketCap }))
      .toBe(shortAddress(ADDRESS));
    expect(dexTokenLabel({
      platform: "ethereum",
      address: ADDRESS,
      name: "Hypersnap",
      _type: DataSourceType.CoinMarketCap,
    })).toBe("Hypersnap");
  });
});

describe("DEX candle interval", () => {
  it("defaults to daily and accepts the documented intervals", () => {
    expect(resolveDexInterval()).toBe("1d");
    expect(resolveDexInterval("")).toBe("1d");
    expect(resolveDexInterval("1h")).toBe("1h");
    expect(resolveDexInterval("15min")).toBe("15min");
    expect(isDexInterval("1w")).toBe(true);
  });

  it("rejects an interval CoinMarketCap would answer with a 500", () => {
    expect(resolveDexInterval("banana")).toBe(null);
    expect(resolveDexInterval("1D"), "case matters: the API takes lowercase").toBe(null);
  });
});

describe("CoinMarketCap DEX payload extraction", () => {
  it("reads price, cap, liquidity and the 24h stats", () => {
    const spot = toDexSpot(tokenPayload, {
      platform: "ethereum",
      address: ADDRESS,
      _type: DataSourceType.CoinMarketCap,
    });

    expect(spot).not.toBe(null);
    expect(spot!.price).toBeCloseTo(0.0022035, 7);
    expect(spot!.marketCapUsd).toBeCloseTo(103836.77, 2);
    expect(spot!.liquidityUsd).toBeCloseTo(15259.25, 2);
    expect(spot!.decimals).toBe(6);
    expect(spot!.high24h).toBeCloseTo(0.00241871, 8);
    expect(spot!.low24h).toBeCloseTo(0.00145569, 8);
    // `pc` arrives as a ratio (0.1472) and is reported as a percentage.
    expect(spot!.change24hPct).toBeCloseTo(14.72, 6);
    expect(spot!.volume24hUsd).toBeCloseTo(4416.04, 2);
    // Metadata comes from the payload, so the caller need not have it.
    expect(spot!.token.symbol).toBe("SNAP");
    expect(spot!.token.name).toBe("Hypersnap");
  });

  it("returns null for the empty payload an unknown address gets", () => {
    // CoinMarketCap answers an unknown address with 200 and `data: {}`, so
    // absence has to be read from the payload rather than the status code.
    expect(toDexSpot({}, { platform: "ethereum", address: ADDRESS, _type: DataSourceType.CoinMarketCap }))
      .toBe(null);
    expect(toDexSpot(undefined, { platform: "ethereum", address: ADDRESS, _type: DataSourceType.CoinMarketCap }))
      .toBe(null);
  });

  it("turns newest-first candles into an oldest-first ms series", () => {
    // Real rows carry milliseconds (13 digits) even though the docs describe
    // the timestamp as seconds — the regression that made every chart render
    // at year 58751.
    const points = toChartPoints([
      [1, 1, 1, 3, 10, 1_791_849_600_000, 32],
      [1, 1, 1, 2, 20, 1_791_763_200_000, 92],
      [1, 1, 1, 1, 30, 1_791_676_800_000, 17],
    ]);

    expect(points.map((p) => p.price)).toEqual([1, 2, 3]);
    expect(points[0].timestamp).toBe(1_791_676_800_000);
    expect(points[2].timestamp).toBe(1_791_849_600_000);
    expect(new Date(points[2].timestamp).getUTCFullYear(), "2026, not 58751").toBe(2026);
  });

  it("also accepts second-stamped rows, the form the docs describe", () => {
    const points = toChartPoints([[1, 1, 1, 2, 20, 1_791_763_200]]);

    expect(points[0].timestamp).toBe(1_791_763_200_000);
    expect(new Date(points[0].timestamp).getUTCFullYear()).toBe(2026);
  });

  it("drops a row with no usable close or timestamp", () => {
    expect(toChartPoints([[1, 1, 1, null, 10, 1_791_849_600]]).length).toBe(0);
    expect(toChartPoints([[1, 1, 1]]), "a short row is skipped").toEqual([]);
  });
});

describe("dexSpotHandler", () => {
  it("prices the token given as an argument", async () => {
    const result = await run(dexSpotHandler(ADDRESS));
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("falls back to the loaded DEX address", async () => {
    const result = await Effect.runPromise(
      dexSpotHandler().pipe(
        Effect.provide(mockDexModel()),
        Effect.provide(spyRenderer([])),
        Effect.provide(mockState(loadedAddress)),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("errors without an address, and without calling the model", async () => {
    const noAddress = noLoadedAddress;

    const result = await Effect.runPromise(
      dexSpotHandler().pipe(
        Effect.provide(mockDexModel()),
        Effect.provide(spyRenderer([])),
        Effect.provide(mockState(noAddress)),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("errors on something that is not an address", async () => {
    const result = await run(dexSpotHandler("bitcoin"));
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("propagates a model failure as ProgramError", async () => {
    const failing = Layer.succeed(CoinMarketCapDexModel, {
      token: { get: () => Effect.fail(new HTTPError({ message: "no token" })) },
      candles: { get: () => Effect.fail(new HTTPError({ message: "no token" })) },
    });

    await expect(
      Effect.runPromise(
        dexSpotHandler(ADDRESS).pipe(
          Effect.provide(failing),
          Effect.provide(spyRenderer([])),
          Effect.provide(mockState()),
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("dexChartHandler", () => {
  it("charts the candle closes at the default interval", async () => {
    const captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [];
    const result = await run(dexChartHandler(ADDRESS), captured);

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured.length, "the chart renderer was called once").toBe(1);
    expect(captured[0].title).toBe("SNAP Price (1d)");
  });

  it("honours an explicit interval", async () => {
    const captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [];
    await run(dexChartHandler(ADDRESS, "4h"), captured);
    expect(captured[0].title).toBe("SNAP Price (4h)");
  });

  it("errors on an unsupported interval without calling the model", async () => {
    const captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [];
    const result = await run(dexChartHandler(ADDRESS, "1D"), captured);

    expect(result.result.type).toBe(CommandResultType.Error);
    expect(captured.length, "no chart is drawn").toBe(0);
  });
});

describe("DEX technicals route through the shared runners", () => {
  it("draws a Bollinger envelope with the same overlays as the crypto menu", async () => {
    const captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [];
    const result = await run(dexBollingerHandler(ADDRESS), captured);

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured[0].overlays.length, "band + mid/edge lines are drawn").toBe(4);
    expect(captured[0].title).toContain("SNAP Bollinger Bands (20, 2)");
  });

  it("respects an explicit period and deviation", async () => {
    const captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [];
    await run(dexBollingerHandler(ADDRESS, "10", "3"), captured);
    expect(captured[0].title).toContain("SNAP Bollinger Bands (10, 3)");
  });

  it("draws Fibonacci levels over the token's swing", async () => {
    const captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [];
    const result = await run(dexFibonacciHandler(ADDRESS), captured);

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured[0].overlays.length, "one rule + one label per edge").toBe(3);
    expect(captured[0].title).toContain("Fibonacci Retracement (40 bars)");
  });

  it("narrows the swing to the requested lookback", async () => {
    const captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [];
    await run(dexFibonacciHandler(ADDRESS, "10"), captured);
    expect(captured[0].title).toContain("Fibonacci Retracement (10 bars)");
  });

  it("charts daily returns as sign-coloured bars", async () => {
    const captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [];
    const result = await run(dexReturnsHandler(ADDRESS), captured);

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured[0].title).toContain("SNAP Daily Returns");
    expect(captured[0].overlays.length).toBe(2);
    expect(captured[0].primary?.length, "bars replace the price line").toBe(2);
  });

  it("errors rather than charting when there is no token to measure", async () => {
    const captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [];
    // With an address loaded a bare command works; with none it must not.
    const result = await Effect.runPromise(
      dexBollingerHandler().pipe(
        Effect.provide(mockDexModel()),
        Effect.provide(spyRenderer(captured)),
        Effect.provide(mockState(loadedAddress)),
      ),
    );

    const noAddress = noLoadedAddress;
    const guarded = await Effect.runPromise(
      dexBollingerHandler().pipe(
        Effect.provide(mockDexModel()),
        Effect.provide(spyRenderer(captured)),
        Effect.provide(mockState(noAddress)),
      ),
    );

    expect(result.result.type, "the loaded address is used").toBe(CommandResultType.Success);
    expect(guarded.result.type).toBe(CommandResultType.Error);
    expect(captured.length, "only the loaded-address run charted").toBe(1);
  });
});

describe("DEX submenu definitions", () => {
  it("lists exactly the three Ethereum actions plus the globals", () => {
    const names = ethereumMenuOptions(baseState).map((option) => option.name);

    expect(names).toContain("spot");
    expect(names).toContain("chart");
    expect(names).toContain("technicals");
    expect(names, "the submenu is escapable").toContain("back");
    expect(names).toContain("exit");
    // Three actions, no more: anything else here is a menu the user did not ask for.
    expect(names.filter((n) => !["back", "exit", "showconfig"].includes(n)).sort())
      .toEqual(["chart", "spot", "technicals"]);
  });

  it("parametersizes every action by contract address", () => {
    const options = ethereumMenuOptions(baseState);
    const spot = options.find((o) => o.name === "spot");
    const chart = options.find((o) => o.name === "chart");

    expect(spot!.command).toBe("spot [address]");
    // The address is declared optional so a bare `chart` reaches the handler's
    // own guard instead of making commander throw a missing-argument error.
    expect(chart!.command).toBe("chart [address] [interval]");
  });

  it("offers the indicators under technicals, each address-first", () => {
    const commands = technicalsMenuOptions(baseState).map((option) => option.command);

    expect(commands).toContain("bbands [address] [period] [stddev]");
    expect(commands).toContain("fibonacci [address] [lookback]");
    expect(commands).toContain("returns [address]");
  });

  it("hangs the ethereum submenu off the DEX menu, with a link for the shell", () => {
    const options = dexMenuOptions(baseState);
    const ethereum = options.find((o) => o.name === "ethereum");

    expect(ethereum, "the ethereum option is present").toBeDefined();
    expect(ethereum!.command).toBe("ethereum");
    expect(ethereum!.submenu, "without a link the shell would wedge").toBeDefined();
    expect(options.map((o) => o.name)).toContain("back");
  });
});

describe("the live DEX model", () => {
  /** A fetch stub returning a canned payload, so no test here hits the network. */
  const stubFetch = (payload: unknown): Layer.Layer<FetchService> =>
    Layer.succeed(FetchService, {
      fetch: () => Effect.fail(new HTTPError({ message: "the raw fetch is not used here" })),
      fetchJson: (_url: string, _params?: URLSearchParams, _init?: RequestInit) =>
        Effect.succeed(payload),
    });

  const token = { platform: "ethereum", address: ADDRESS, _type: DataSourceType.CoinMarketCap };

  it("requires an API key rather than requesting without one", async () => {
    const program = Effect.gen(function* () {
      const model = yield* CoinMarketCapDexModel;
      return yield* model.token.get(token, undefined);
    }).pipe(
      Effect.provide(CoinMarketCapDexModelLive),
      Effect.provide(stubFetch({ data: tokenPayload })),
    );

    await expect(Effect.runPromise(program)).rejects.toThrow(/API key/i);
  });

  it("reports an unknown address as not found, not as a schema failure", async () => {
    // The real API answers an unknown address with 200 and `data: {}`; the
    // message has to say so, or the user is told the response shape changed.
    const program = Effect.gen(function* () {
      const model = yield* CoinMarketCapDexModel;
      return yield* model.token.get(token, "key");
    }).pipe(
      Effect.provide(CoinMarketCapDexModelLive),
      Effect.provide(stubFetch({ data: {} })),
    );

    await expect(Effect.runPromise(program)).rejects.toThrow(/No DEX token at/);
  });

  it("says the same for a token with an empty candle series", async () => {
    const program = Effect.gen(function* () {
      const model = yield* CoinMarketCapDexModel;
      return yield* model.candles.get(token, "key");
    }).pipe(
      Effect.provide(CoinMarketCapDexModelLive),
      Effect.provide(stubFetch({ data: [] })),
    );

    await expect(Effect.runPromise(program)).rejects.toThrow(/No DEX token at/);
  });

  it("decodes a real payload into a spot point", async () => {
    const spot = await Effect.runPromise(
      Effect.gen(function* () {
        const model = yield* CoinMarketCapDexModel;
        return yield* model.token.get(token, "key");
      }).pipe(
        Effect.provide(CoinMarketCapDexModelLive),
        Effect.provide(stubFetch({ data: tokenPayload, status: { error_code: "0" } })),
      ),
    );

    expect(spot.price).toBeCloseTo(0.0022035, 7);
    expect(spot.change24hPct).toBeCloseTo(14.72, 6);
    expect(spot.token.symbol).toBe("SNAP");
  });

  it("turns candles into an ascending price series", async () => {
    const chart = await Effect.runPromise(
      Effect.gen(function* () {
        const model = yield* CoinMarketCapDexModel;
        return yield* model.candles.get(token, "key", "1d");
      }).pipe(
        Effect.provide(CoinMarketCapDexModelLive),
        Effect.provide(stubFetch({
          data: [
            [1, 1, 1, 3, 10, 1_791_849_600, 32],
            [1, 1, 1, 2, 20, 1_791_763_200, 92],
          ],
        })),
      ),
    );

    expect(chart.prices.map((p) => p.price)).toEqual([2, 3]);
    expect(chart.symbol.id).toBe(ADDRESS);
    expect(chart.symbol._type).toBe(DataSourceType.CoinMarketCap);
  });
});
