import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { forexChartHandler, forexSpotHandler } from "./alpaca.ts";
import { AlpacaService } from "src/services/AlpacaService/index.ts";
import type { ForexChartPoint, ForexPairType, ForexQuote } from "src/services/ForexService/types.ts";
import type { SpotQuote, ChartPoint } from "src/services/AlphaVantageService/index.ts";
import { ChartRenderer } from "../../StocksMenu/services/ChartRenderer.ts";
import { TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../types.ts";
import { HTTPError } from "../../errors/index.ts";
import type { TerminalUserStateConfig } from "../../types.ts";

const mockQuote: ForexQuote = {
  from: "EUR",
  to: "USD",
  fromName: "EUR",
  toName: "USD",
  rate: 1.087,
  bid: 1.0869,
  ask: 1.0871,
  lastRefreshed: "2026-10-09T18:23:41Z",
  timeZone: "UTC",
};

const now = Date.now();
const mockPoints: ForexChartPoint[] = [
  { date: new Date(now - 30 * 86400000).toISOString().slice(0, 10), open: 1.08, high: 1.08, low: 1.08, close: 1.082, timestamp: now - 30 * 86400000 },
  { date: new Date(now - 2 * 86400000).toISOString().slice(0, 10), open: 1.087, high: 1.087, low: 1.087, close: 1.087, timestamp: now - 2 * 86400000 },
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
    alpaca: undefined,
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
    forex: { datasource: DataSourceType.Alpaca },
  },
  scriptContext: {},
};

const mockState = Layer.succeed(TerminalUserStateConfigContext, baseState);

const mockAlpaca = (points: ForexChartPoint[] = mockPoints) =>
  Layer.succeed(AlpacaService, {
    getStockSpot: (_s: unknown) => Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<SpotQuote, HTTPError>,
    getStockChart: (_s: unknown) => Effect.succeed([] as ChartPoint[]),
    getOptionExpirations: (_u: string) => Effect.succeed([] as number[]),
    getOptionChain: (_s: unknown, _e: number) => Effect.fail(new HTTPError({ message: "unused" })),
    getForexSpot: (_p: ForexPairType) => Effect.succeed(mockQuote),
    getForexDaily: (_p: ForexPairType) => Effect.succeed(points),
    getFixedIncomeLatestPrices: (_i: readonly string[]) => Effect.succeed([]),
  });

const mockChartRenderer = Layer.succeed(ChartRenderer, {
  render: (_data, _x, _y, _title) => Effect.void,
  renderTechnical: (_data, _x, _y, _overlays, _title) => Effect.void,
});

describe("Alpaca forexSpotHandler", () => {
  it("returns success for a valid pair", async () => {
    const result = await Effect.runPromise(
      forexSpotHandler("EUR", "USD").pipe(Effect.provide(mockAlpaca()), Effect.provide(mockState)),
    );
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("errors on an invalid pair", async () => {
    const result = await Effect.runPromise(
      forexSpotHandler("EU", "USD").pipe(Effect.provide(mockAlpaca()), Effect.provide(mockState)),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("errors when both currencies are the same", async () => {
    const result = await Effect.runPromise(
      forexSpotHandler("USD", "USD").pipe(Effect.provide(mockAlpaca()), Effect.provide(mockState)),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });
});

describe("Alpaca forexChartHandler", () => {
  it("returns success and charts within range", async () => {
    const result = await Effect.runPromise(
      forexChartHandler("EUR", "USD").pipe(
        Effect.provide(mockAlpaca()),
        Effect.provide(mockChartRenderer),
        Effect.provide(mockState),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("errors on an invalid date range", async () => {
    const result = await Effect.runPromise(
      forexChartHandler("EUR", "USD", "2026-05-01", "2026-01-01").pipe(
        Effect.provide(mockAlpaca()),
        Effect.provide(mockChartRenderer),
        Effect.provide(mockState),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("errors when no data falls in range", async () => {
    const result = await Effect.runPromise(
      forexChartHandler("EUR", "USD", "2020-01-01", "2020-02-01").pipe(
        Effect.provide(mockAlpaca()),
        Effect.provide(mockChartRenderer),
        Effect.provide(mockState),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });
});
