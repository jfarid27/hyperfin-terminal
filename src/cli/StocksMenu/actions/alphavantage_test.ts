import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { spotPriceHandler, chartPriceHandler } from "./alphavantage.ts";
import { AlphaVantageService, type SpotQuote, type ChartPoint } from "src/services/AlphaVantageService/index.ts";
import { ChartRenderer } from "../services/ChartRenderer.ts";
import { TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../types.ts";
import { HTTPError } from "../../errors/index.ts";
import type { TerminalUserStateConfig } from "../../types.ts";

// ── Fixtures ──

const mockSpotQuote: SpotQuote = {
  symbol: "NVDA",
  price: 200.75,
  change: 5.71,
  changePercent: "2.9276%",
  open: 198.4405,
  high: 202.0,
  low: 194.95,
  previousClose: 195.04,
  volume: 139961152,
  latestTradingDay: "2026-07-31",
};

const mockChartPoints: ChartPoint[] = [
  { date: "2026-07-29", open: 195.845, high: 197.074, low: 190.01, close: 190.01, volume: 147680809, timestamp: new Date("2026-07-29").getTime() },
  { date: "2026-07-30", open: 193.45, high: 197.25, low: 191.52, close: 195.04, volume: 129010151, timestamp: new Date("2026-07-30").getTime() },
  { date: "2026-07-31", open: 198.4405, high: 202.0, low: 194.95, close: 200.75, volume: 139961152, timestamp: new Date("2026-07-31").getTime() },
];

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
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
  },
  scriptContext: {},
};

// ── Mock layers ──

const mockAlphaVantage = Layer.succeed(AlphaVantageService, {
  getSpot: (_symbol) => Effect.succeed(mockSpotQuote),
  getChart: (_symbol) => Effect.succeed(mockChartPoints),
});

const mockChartRenderer = Layer.succeed(ChartRenderer, {
  render: (_data, _x, _y, _title) => Effect.void,
});

const mockState = (overrides?: Partial<TerminalUserStateConfig>) =>
  Layer.succeed(TerminalUserStateConfigContext, { ...baseState, ...overrides });

// ── Tests ──

describe("spotPriceHandler", () => {
  it("returns success with spot quote for a valid symbol", async () => {
    const program = spotPriceHandler("NVDA").pipe(
      Effect.provide(mockAlphaVantage),
      Effect.provide(mockState()),
    );

    const result = await Effect.runPromise(program);
    expect(result.result.type).toBe(CommandResultType.Success);
    expect(result.state).toBeDefined();
  });

  it("returns error when no symbol is provided and no loaded token", async () => {
    const program = spotPriceHandler("").pipe(
      Effect.provide(mockAlphaVantage),
      Effect.provide(mockState()),
    );

    const result = await Effect.runPromise(program);
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("uses loaded token when no symbol string is passed", async () => {
    const stateWithToken = {
      ...baseState,
      loadedContext: {
        ...baseState.loadedContext,
        token: { symbol: "AAPL" },
      },
    };

    const program = spotPriceHandler("").pipe(
      Effect.provide(mockAlphaVantage),
      Effect.provide(mockState(stateWithToken)),
    );

    const result = await Effect.runPromise(program);
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("propagates service errors as ProgramError", async () => {
    const failingMock = Layer.succeed(AlphaVantageService, {
      getSpot: (_symbol) => Effect.fail(new HTTPError({ message: "API down" })),
      getChart: (_symbol) => Effect.fail(new HTTPError({ message: "API down" })),
    });

    const program = spotPriceHandler("NVDA").pipe(
      Effect.provide(failingMock),
      Effect.provide(mockState()),
    );

    await expect(Effect.runPromise(program)).rejects.toThrow();
  });
});

describe("chartPriceHandler", () => {
  it("returns success with chart points for a valid symbol", async () => {
    const program = chartPriceHandler("NVDA").pipe(
      Effect.provide(mockAlphaVantage),
      Effect.provide(mockChartRenderer),
      Effect.provide(mockState()),
    );

    const result = await Effect.runPromise(program);
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("returns error when no symbol is provided", async () => {
    const program = chartPriceHandler("").pipe(
      Effect.provide(mockAlphaVantage),
      Effect.provide(mockChartRenderer),
      Effect.provide(mockState()),
    );

    const result = await Effect.runPromise(program);
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("uses loaded token when no symbol string is passed", async () => {
    const stateWithToken = {
      ...baseState,
      loadedContext: {
        ...baseState.loadedContext,
        token: { symbol: "MSFT" },
      },
    };

    const program = chartPriceHandler("").pipe(
      Effect.provide(mockAlphaVantage),
      Effect.provide(mockChartRenderer),
      Effect.provide(mockState(stateWithToken)),
    );

    const result = await Effect.runPromise(program);
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("propagates service errors as ProgramError", async () => {
    const failingMock = Layer.succeed(AlphaVantageService, {
      getSpot: (_symbol) => Effect.fail(new HTTPError({ message: "API down" })),
      getChart: (_symbol) => Effect.fail(new HTTPError({ message: "API down" })),
    });

    const program = chartPriceHandler("NVDA").pipe(
      Effect.provide(failingMock),
      Effect.provide(mockChartRenderer),
      Effect.provide(mockState()),
    );

    await expect(Effect.runPromise(program)).rejects.toThrow();
  });
});
