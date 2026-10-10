import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { chainHandler, resolveExpiration, volcurveHandler } from "./alpaca.ts";
import { AlpacaService } from "src/services/AlpacaService/index.ts";
import type { OptionContract, OptionsChain } from "src/services/OptionsService/types.ts";
import type { SpotQuote, ChartPoint } from "src/services/AlphaVantageService/index.ts";
import type { ForexChartPoint, ForexPairType, ForexQuote } from "src/services/ForexService/types.ts";
import type { StockSymbolType } from "../../StocksMenu/types.ts";
import { TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../types.ts";
import { HTTPError } from "../../errors/index.ts";
import type { TerminalUserStateConfig } from "../../types.ts";

// ── Fixtures ──

const EXP_1 = Math.floor(Date.UTC(2026, 9, 12) / 1000);
const EXP_2 = Math.floor(Date.UTC(2026, 10, 20) / 1000);
const expirations = [EXP_1, EXP_2];

const contract = (overrides: Partial<OptionContract>): OptionContract => ({
  contractSymbol: "AAPL261012C00245000",
  strike: 245,
  lastPrice: 91.81,
  change: 1.16,
  percentChange: 1.28,
  volume: 9,
  openInterest: 0,
  bid: 89.07,
  ask: 93.6,
  impliedVolatility: 0,
  inTheMoney: true,
  expiration: EXP_1,
  lastTradeDate: 0,
  currency: "USD",
  contractSize: "REGULAR",
  ...overrides,
});

const mockChain: OptionsChain = {
  ticker: "AAPL",
  expiration: EXP_1,
  expirationDate: "2026-10-12",
  underlyingPrice: 335.86,
  calls: [contract({})],
  puts: [contract({ contractSymbol: "AAPL261012P00245000", strike: 245, inTheMoney: false })],
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
    options: { datasource: DataSourceType.Alpaca },
  },
  scriptContext: {},
};

const mockState = (overrides?: Partial<TerminalUserStateConfig>) =>
  Layer.succeed(TerminalUserStateConfigContext, { ...baseState, ...overrides });

const mockAlpaca = (chain: OptionsChain = mockChain) =>
  Layer.succeed(AlpacaService, {
    getStockSpot: (_s: StockSymbolType) => Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<SpotQuote, HTTPError>,
    getStockChart: (_s: StockSymbolType) => Effect.succeed([] as ChartPoint[]),
    getOptionExpirations: (_underlying: string) => Effect.succeed(expirations),
    getOptionChain: (_symbol, _expiration: number) => Effect.succeed(chain),
    getForexSpot: (_p: ForexPairType) => Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<ForexQuote, HTTPError>,
    getForexDaily: (_p: ForexPairType) => Effect.succeed([] as ForexChartPoint[]),
    getFixedIncomeLatestPrices: (_isins: readonly string[]) => Effect.succeed([]),
  });

// ── Tests ──

describe("resolveExpiration", () => {
  it("returns the nearest expiration when no selector is given", () => {
    expect(resolveExpiration(undefined, expirations)).toBe(EXP_1);
  });

  it("resolves a 1-based index", () => {
    expect(resolveExpiration("2", expirations)).toBe(EXP_2);
  });

  it("resolves a YYYY-MM-DD date", () => {
    expect(resolveExpiration("2026-10-12", expirations)).toBe(EXP_1);
  });

  it("returns null for an unmatched selector", () => {
    expect(resolveExpiration("2099-01-01", expirations)).toBe(null);
    expect(resolveExpiration(undefined, [])).toBe(null);
  });
});

describe("Alpaca chainHandler", () => {
  it("returns success for a valid symbol", async () => {
    const result = await Effect.runPromise(
      chainHandler("AAPL").pipe(Effect.provide(mockAlpaca()), Effect.provide(mockState())),
    );
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("errors on an unmatched expiration", async () => {
    const result = await Effect.runPromise(
      chainHandler("AAPL", "2099-01-01").pipe(Effect.provide(mockAlpaca()), Effect.provide(mockState())),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("errors when there are no expirations", async () => {
    const empty = Layer.succeed(AlpacaService, {
      getStockSpot: (_s: StockSymbolType) => Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<SpotQuote, HTTPError>,
      getStockChart: (_s: StockSymbolType) => Effect.succeed([] as ChartPoint[]),
      getOptionExpirations: (_underlying: string) => Effect.succeed([] as number[]),
      getOptionChain: (_symbol, _expiration: number) => Effect.succeed(mockChain),
      getForexSpot: (_p: ForexPairType) => Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<ForexQuote, HTTPError>,
      getForexDaily: (_p: ForexPairType) => Effect.succeed([] as ForexChartPoint[]),
      getFixedIncomeLatestPrices: (_isins: readonly string[]) => Effect.succeed([]),
    });

    const result = await Effect.runPromise(
      chainHandler("AAPL").pipe(Effect.provide(empty), Effect.provide(mockState())),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });
});

describe("Alpaca volcurveHandler", () => {
  it("errors clearly when IV is unavailable (indicative feed)", async () => {
    const result = await Effect.runPromise(
      volcurveHandler("AAPL").pipe(Effect.provide(mockAlpaca()), Effect.provide(mockState())),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("succeeds when IV is present", async () => {
    const withIv: OptionsChain = {
      ...mockChain,
      calls: [
        contract({ strike: 240, impliedVolatility: 0.42 }),
        contract({ strike: 250, impliedVolatility: 0.38 }),
      ],
    };
    const result = await Effect.runPromise(
      volcurveHandler("AAPL").pipe(Effect.provide(mockAlpaca(withIv)), Effect.provide(mockState())),
    );
    expect(result.result.type).toBe(CommandResultType.Success);
  });
});
