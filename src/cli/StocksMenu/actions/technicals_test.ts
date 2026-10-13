import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { bollingerHandler, fibonacciHandler, parsePositiveInt, returnsHandler, toSeriesPoints } from "./technicals.ts";
import { technicalsMenuOptions } from "../TechnicalsMenu/menu.ts";
import { AlphaVantageService, type ChartPoint } from "src/services/AlphaVantageService/index.ts";
import { AlpacaService } from "src/services/AlpacaService/index.ts";
import { ChartRenderer } from "../services/ChartRenderer.ts";
import { ConfigService } from "src/cli/services/ConfigService.ts";
import { FetchService } from "src/cli/services/FetchService.ts";
import { TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../types.ts";
import { HTTPError } from "../../errors/index.ts";
import { mapErrorsToCommandResults } from "../../errors/index.ts";
import type { TerminalUserStateConfig } from "../../types.ts";
import { Option } from "effect";

// ── Fixtures ──

const bars: ChartPoint[] = Array.from({ length: 40 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
  open: 100 + i,
  high: 102 + i,
  low: 99 + i,
  close: 100 + Math.sin(i / 4) * 8 + i * 0.7,
  volume: 1_000_000,
  timestamp: Date.UTC(2026, 0, 1 + i),
}));

/** Massive's /v2/aggs daily bars for the same series, as the API returns them. */
const massiveResponse = {
  ticker: "NVDA",
  results: bars.map((b) => ({ t: b.timestamp, c: b.close })),
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
    coinmarketcap: undefined,
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
  },
  scriptContext: {},
};

// ── Mock layers ──

const mockAV = (points: ChartPoint[] = bars) =>
  Layer.succeed(AlphaVantageService, {
    getSpot: (_symbol) => Effect.fail(new HTTPError({ message: "unused" })),
    getChart: (_symbol) => Effect.succeed(points),
    searchSymbols: (_query) => Effect.succeed([]),
  });

const mockConfig = (massiveKey: string | undefined) =>
  Layer.succeed(ConfigService, {
    ENVIRONMENT: EnvironmentType.Development,
    ALPHAVANTAGE_API_KEY: Option.none(),
    MASSIVE_API_KEY: massiveKey === undefined ? Option.none() : Option.some(massiveKey),
    COINGECKO_API_KEY: Option.none(),
    BLOCKCHAINCOM_API_KEY: Option.none(),
    FREECRYPTOAPI_API_KEY: Option.none(),
    FRED_API_KEY: Option.none(),
    ALPACA_API_KEY: Option.none(),
    ALPACA_API_SECRET: Option.none(),
  });

const mockFetch = (response: unknown) =>
  Layer.succeed(FetchService, {
    fetch: (_url, _params?, _init?) => Effect.succeed(new Response()),
    fetchJson: (_url, _params?, _init?) => Effect.succeed(response),
  });

/** Alpaca's daily bars, exposed through the service port the technicals use. */
const mockAlpaca = (points: ChartPoint[] = bars) =>
  Layer.succeed(AlpacaService, {
    getStockSpot: (_symbol) => Effect.fail(new HTTPError({ message: "unused" })),
    getStockChart: (_symbol) => Effect.succeed(points),
    getOptionExpirations: (_underlying) => Effect.succeed([]),
    getOptionChain: (_symbol, _expiration) => Effect.fail(new HTTPError({ message: "unused" })),
    getForexSpot: (_pair) => Effect.fail(new HTTPError({ message: "unused" })),
    getForexDaily: (_pair) => Effect.succeed([]),
    getFixedIncomeLatestPrices: (_isins) => Effect.succeed([]),
  });

const captured: { overlays: unknown[]; title?: string; primary?: unknown[] }[] = [];
const spyRenderer = Layer.succeed(ChartRenderer, {
  render: (_data, _x, _y) => Effect.void,
  renderTechnical: (_data, _x, _y, overlays, title, _yLabel, primary) => {
    captured.push({ overlays, title, primary });
    return Effect.void;
  },
});

const mockState = (overrides?: Partial<TerminalUserStateConfig>) =>
  Layer.succeed(TerminalUserStateConfigContext, { ...baseState, ...overrides });

const layer = (
  av = mockAV(),
  cfg = mockConfig(undefined),
  fs = mockFetch({}),
  state = mockState(),
  alpaca = mockAlpaca(),
) => Layer.mergeAll(av, cfg, fs, alpaca, spyRenderer, state);

// ── Tests ──

describe("stocks technicals — helpers", () => {
  it("keeps only finite close values, sorted oldest-first", () => {
    const points = toSeriesPoints([
      { ...bars[2] },
      { ...bars[0] },
      { ...bars[1], close: Number.NaN },
    ]);

    expect(points.length, "the NaN bar is dropped").toBe(2);
    expect(points[0].timestamp).toBe(bars[0].timestamp);
    expect(points[1].timestamp).toBe(bars[2].timestamp);
  });

  it("parses a period the same way the crypto menu does", () => {
    expect(parsePositiveInt("14", 20)).toBe(14);
    expect(parsePositiveInt("junk", 20)).toBe(20);
  });
});

describe("stocks technicals submenu definition", () => {
  it("lists bbands, fibonacci and returns with chart-style parameters", () => {
    const options = technicalsMenuOptions(baseState);

    const bbands = options.find((o) => o.name === "bbands");
    const fibonacci = options.find((o) => o.name === "fibonacci");
    const returns = options.find((o) => o.name === "returns");

    expect(bbands, "the bbands option is present").toBeDefined();
    expect(fibonacci, "the fibonacci option is present").toBeDefined();
    expect(returns, "the returns option is present").toBeDefined();
    // The parameter structure mirrors `chart`: an optional leading symbol that
    // falls back to the loaded token, then the indicator's own arguments.
    expect(bbands!.command).toBe("bbands [symbol] [period] [stddev]");
    expect(fibonacci!.command).toBe("fibonacci [symbol] [lookback]");
    expect(returns!.command).toBe("returns [symbol]");
  });

  it("keeps the back option so the submenu is escapable", () => {
    const options = technicalsMenuOptions(baseState);
    expect(options.some((o) => o.name === "back")).toBe(true);
  });
});

describe("stocks bollingerHandler", () => {
  it("charts the envelope from the AlphaVantage bars", async () => {
    captured.length = 0;
    const result = await Effect.runPromise(
      bollingerHandler("NVDA").pipe(Effect.provide(layer())),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured[0].title).toContain("NVDA Bollinger Bands (20, 2)");
    expect(captured[0].overlays.length).toBe(4);
  });

  it("uses the Massive aggregate bars when that is the active source", async () => {
    captured.length = 0;
    const massiveState = mockState({
      ...baseState,
      loadedContext: {
        ...baseState.loadedContext,
        stocks: { datasource: DataSourceType.Massive },
      },
    });

    const result = await Effect.runPromise(
      bollingerHandler("NVDA").pipe(
        Effect.provide(layer(mockAV(), mockConfig("key"), mockFetch(massiveResponse), massiveState)),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured[0].title).toContain("NVDA Bollinger Bands (20, 2)");
  });

  it("errors on the Massive source when the key is missing", async () => {
    captured.length = 0;
    const massiveState = mockState({
      ...baseState,
      loadedContext: {
        ...baseState.loadedContext,
        stocks: { datasource: DataSourceType.Massive },
      },
    });

    // The missing key surfaces as a ProgramError; the menu runner maps that to
    // an Error result rather than charting anything.
    const result = await Effect.runPromise(
      bollingerHandler("NVDA").pipe(
        mapErrorsToCommandResults(baseState),
        Effect.provide(layer(mockAV(), mockConfig(undefined), mockFetch(massiveResponse), massiveState)),
      ),
    );

    expect(result.result.type, "no chart is drawn without a key").toBe(CommandResultType.Error);
    expect(captured.length).toBe(0);
  });

  it("errors when there is no symbol to resolve", async () => {
    captured.length = 0;
    const result = await Effect.runPromise(
      bollingerHandler("").pipe(Effect.provide(layer())),
    );

    expect(result.result.type).toBe(CommandResultType.Error);
  });
});

describe("stocks fibonacciHandler", () => {
  it("charts retracement levels and honours a lookback", async () => {
    captured.length = 0;
    const result = await Effect.runPromise(
      fibonacciHandler("NVDA", "15").pipe(Effect.provide(layer())),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured[0].title).toContain("Fibonacci Retracement (15 bars)");
    expect(captured[0].overlays.length).toBe(3);
  });

  it("errors when the bars have no swing", async () => {
    captured.length = 0;
    const flat = bars.map((b) => ({ ...b, close: 50 }));
    const result = await Effect.runPromise(
      fibonacciHandler("NVDA").pipe(Effect.provide(layer(mockAV(flat)))),
    );

    expect(result.result.type).toBe(CommandResultType.Error);
  });
});

describe("stocks returnsHandler", () => {
  const alpacaState = mockState({
    ...baseState,
    loadedContext: {
      ...baseState.loadedContext,
      stocks: { datasource: DataSourceType.Alpaca },
    },
  });

  it("charts the daily percent returns as sign-coloured bars", async () => {
    captured.length = 0;
    const result = await Effect.runPromise(
      returnsHandler("NVDA").pipe(Effect.provide(layer())),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured[0].title).toContain("NVDA Daily Returns");
    // Two overlays: the zero baseline and the ±2σ guide bands. The returns
    // themselves are the primary series — an up-bar and a down-bar mark.
    expect(captured[0].overlays.length).toBe(2);
    expect(captured[0].primary?.length, "bars replace the price line").toBe(2);
  });

  it("uses the Alpaca daily bars when that is the active source", async () => {
    captured.length = 0;
    const result = await Effect.runPromise(
      returnsHandler("NVDA").pipe(
        Effect.provide(layer(mockAV(), mockConfig(undefined), mockFetch({}), alpacaState)),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured[0].title).toContain("NVDA Daily Returns");
    expect(captured[0].primary?.length).toBe(2);
  });

  it("reports an Alpaca failure instead of charting anything", async () => {
    captured.length = 0;
    const failingAlpaca = Layer.succeed(AlpacaService, {
      getStockSpot: (_symbol) => Effect.fail(new HTTPError({ message: "unused" })),
      getStockChart: (_symbol) => Effect.fail(new HTTPError({ message: "403 forbidden" })),
      getOptionExpirations: (_underlying) => Effect.succeed([]),
      getOptionChain: (_symbol, _expiration) => Effect.fail(new HTTPError({ message: "unused" })),
      getForexSpot: (_pair) => Effect.fail(new HTTPError({ message: "unused" })),
      getForexDaily: (_pair) => Effect.succeed([]),
      getFixedIncomeLatestPrices: (_isins) => Effect.succeed([]),
    });

    const result = await Effect.runPromise(
      returnsHandler("NVDA").pipe(
        Effect.provide(
          layer(mockAV(), mockConfig(undefined), mockFetch({}), alpacaState, failingAlpaca),
        ),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Error);
    expect(captured.length, "no chart is drawn on an Alpaca failure").toBe(0);
  });

  it("errors when the series cannot produce a single return", async () => {
    captured.length = 0;
    const result = await Effect.runPromise(
      returnsHandler("NVDA").pipe(Effect.provide(layer(mockAV([bars[0]])))),
    );

    expect(result.result.type).toBe(CommandResultType.Error);
    expect(captured.length).toBe(0);
  });

  it("errors when there is no symbol to resolve", async () => {
    captured.length = 0;
    const result = await Effect.runPromise(
      returnsHandler("").pipe(Effect.provide(layer())),
    );

    expect(result.result.type).toBe(CommandResultType.Error);
  });
});
