import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { bondSpotHandler, isIsin } from "./alpaca.ts";
import { AlpacaService, type FixedIncomeQuote } from "src/services/AlpacaService/index.ts";
import type { SpotQuote, ChartPoint } from "src/services/AlphaVantageService/index.ts";
import type { ForexPairType, ForexQuote, ForexChartPoint } from "src/services/ForexService/types.ts";
import { TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../types.ts";
import { HTTPError } from "../../errors/index.ts";
import type { TerminalUserStateConfig } from "../../types.ts";

const mockQuote: FixedIncomeQuote = {
  isin: "US912797KJ59",
  price: 99.6459,
  asOf: "2025-02-14T20:58:00.648Z",
  yieldToMaturity: 4.249,
  yieldToWorst: 4.249,
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
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
    bonds: { datasource: DataSourceType.Alpaca },
  },
  scriptContext: {},
};

const mockState = Layer.succeed(TerminalUserStateConfigContext, baseState);

const mockAlpaca = (quotes: FixedIncomeQuote[] = [mockQuote]) =>
  Layer.succeed(AlpacaService, {
    getStockSpot: (_s: unknown) => Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<SpotQuote, HTTPError>,
    getStockChart: (_s: unknown) => Effect.succeed([] as ChartPoint[]),
    getOptionExpirations: (_u: string) => Effect.succeed([] as number[]),
    getOptionChain: (_s: unknown, _e: number) => Effect.fail(new HTTPError({ message: "unused" })),
    getForexSpot: (_p: ForexPairType) => Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<ForexQuote, HTTPError>,
    getForexDaily: (_p: ForexPairType) => Effect.succeed([] as ForexChartPoint[]),
    getFixedIncomeLatestPrices: (_i: readonly string[]) => Effect.succeed(quotes),
  });

describe("isIsin", () => {
  it("accepts a well-formed ISIN", () => {
    expect(isIsin("US912797KJ59")).toBe(true);
  });

  it("rejects non-ISIN codes", () => {
    expect(isIsin("US10")).toBe(false);
    expect(isIsin("AAPL")).toBe(false);
    expect(isIsin("US912797KJ5")).toBe(false);
  });
});

describe("Alpaca bondSpotHandler", () => {
  it("returns success for a valid ISIN with a quote", async () => {
    const result = await Effect.runPromise(
      bondSpotHandler("US912797KJ59").pipe(Effect.provide(mockAlpaca()), Effect.provide(mockState)),
    );
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("errors when the code is not an ISIN", async () => {
    const result = await Effect.runPromise(
      bondSpotHandler("US10").pipe(Effect.provide(mockAlpaca()), Effect.provide(mockState)),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("errors when no price is returned for the ISIN", async () => {
    const result = await Effect.runPromise(
      bondSpotHandler("US912797KJ59").pipe(Effect.provide(mockAlpaca([])), Effect.provide(mockState)),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("propagates an entitlement error from the service", async () => {
    const failing = Layer.succeed(AlpacaService, {
      getStockSpot: (_s: unknown) => Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<SpotQuote, HTTPError>,
      getStockChart: (_s: unknown) => Effect.succeed([] as ChartPoint[]),
      getOptionExpirations: (_u: string) => Effect.succeed([] as number[]),
      getOptionChain: (_s: unknown, _e: number) => Effect.fail(new HTTPError({ message: "unused" })),
      getForexSpot: (_p: ForexPairType) => Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<ForexQuote, HTTPError>,
      getForexDaily: (_p: ForexPairType) => Effect.succeed([] as ForexChartPoint[]),
      getFixedIncomeLatestPrices: (_i: readonly string[]) =>
        Effect.fail(new HTTPError({ message: "Alpaca (403) Subscription does not permit querying fixed income" })),
    });

    await expect(
      Effect.runPromise(bondSpotHandler("US912797KJ59").pipe(Effect.provide(failing), Effect.provide(mockState))),
    ).rejects.toThrow();
  });
});
