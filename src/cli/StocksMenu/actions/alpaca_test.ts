import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { chartPriceHandler, spotPriceHandler } from "./alpaca.ts";
import { AlpacaService } from "src/services/AlpacaService/index.ts";
import type { ChartPoint, SpotQuote } from "src/services/AlphaVantageService/index.ts";
import type { StockSymbolType } from "../types.ts";
import type { OptionSymbolType } from "src/services/OptionsService/types.ts";
import type { ForexPairType } from "src/services/ForexService/types.ts";
import { ChartRenderer } from "../services/ChartRenderer.ts";
import { TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../types.ts";
import { HTTPError } from "../../errors/index.ts";
import type { TerminalUserStateConfig } from "../../types.ts";

// ── Fixtures ──

const mockSpotQuote: SpotQuote = {
  symbol: "AAPL",
  price: 335.86,
  change: -4.57,
  changePercent: "-1.3424%",
  open: 331.685,
  high: 338.6,
  low: 330.72,
  previousClose: 340.43,
  volume: 2132531,
  latestTradingDay: "2026-10-09",
};

const mockChartPoints: ChartPoint[] = [
  { date: "2026-10-08", open: 336.9, high: 341.5, low: 335.9, close: 340.43, volume: 1015370, timestamp: new Date("2026-10-08").getTime() },
  { date: "2026-10-09", open: 331.6, high: 338.6, low: 330.7, close: 336.47, volume: 2132531, timestamp: new Date("2026-10-09").getTime() },
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
    stocks: { datasource: DataSourceType.Alpaca },
    options: { datasource: DataSourceType.YahooFinance },
  },
  scriptContext: {},
};

const mockAlpaca = Layer.succeed(AlpacaService, {
  getStockSpot: (_symbol) => Effect.succeed(mockSpotQuote),
  getStockChart: (_symbol) => Effect.succeed(mockChartPoints),
  getOptionExpirations: (_underlying) => Effect.succeed([]),
  getOptionChain: (_symbol, _expiration) => Effect.fail(new HTTPError({ message: "unused" })),
  getForexSpot: (_pair) => Effect.fail(new HTTPError({ message: "unused" })),
  getForexDaily: (_pair) => Effect.fail(new HTTPError({ message: "unused" })),
  getFixedIncomeLatestPrices: (_isins) => Effect.succeed([]),
});

const mockChartRenderer = Layer.succeed(ChartRenderer, {
  render: (_data, _x, _y, _title) => Effect.void,
  renderTechnical: (_data, _x, _y, _overlays, _title) => Effect.void,
});

const mockState = (overrides?: Partial<TerminalUserStateConfig>) =>
  Layer.succeed(TerminalUserStateConfigContext, { ...baseState, ...overrides });

// ── Tests ──

describe("Alpaca spotPriceHandler", () => {
  it("returns success for a valid symbol", async () => {
    const result = await Effect.runPromise(
      spotPriceHandler("AAPL").pipe(Effect.provide(mockAlpaca), Effect.provide(mockState())),
    );
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("returns error when no symbol and no loaded token", async () => {
    const result = await Effect.runPromise(
      spotPriceHandler("").pipe(Effect.provide(mockAlpaca), Effect.provide(mockState())),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("uses the loaded token when no symbol is passed", async () => {
    const stateWithToken: Partial<TerminalUserStateConfig> = {
      loadedContext: {
        ...baseState.loadedContext,
        token: { symbol: "MSFT" },
      },
    } as Partial<TerminalUserStateConfig>;

    const result = await Effect.runPromise(
      spotPriceHandler("").pipe(Effect.provide(mockAlpaca), Effect.provide(mockState(stateWithToken))),
    );
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("requests the Alpaca source for the symbol", async () => {
    const seen: Array<{ id: string; _type: unknown }> = [];
    const spy = Layer.succeed(AlpacaService, {
      getStockSpot: (symbol: StockSymbolType) => {
        seen.push({ id: symbol.id, _type: symbol._type });
        return Effect.succeed(mockSpotQuote);
      },
      getStockChart: (_symbol: StockSymbolType) => Effect.succeed(mockChartPoints),
      getOptionExpirations: (_underlying: string) => Effect.succeed([]),
      getOptionChain: (_symbol: OptionSymbolType, _expiration: number) =>
        Effect.fail(new HTTPError({ message: "unused" })),
      getForexSpot: (_pair: ForexPairType) => Effect.fail(new HTTPError({ message: "unused" })),
      getForexDaily: (_pair: ForexPairType) => Effect.fail(new HTTPError({ message: "unused" })),
      getFixedIncomeLatestPrices: (_isins: readonly string[]) => Effect.succeed([]),
    });

    await Effect.runPromise(
      spotPriceHandler("nvda").pipe(Effect.provide(spy), Effect.provide(mockState())),
    );

    expect(seen[0]?.id).toBe("nvda");
    expect(seen[0]?._type).toBe(DataSourceType.Alpaca);
  });
});

describe("Alpaca chartPriceHandler", () => {
  it("returns success and renders a chart", async () => {
    const result = await Effect.runPromise(
      chartPriceHandler("AAPL").pipe(
        Effect.provide(mockAlpaca),
        Effect.provide(mockChartRenderer),
        Effect.provide(mockState()),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("errors when no symbol is provided", async () => {
    const result = await Effect.runPromise(
      chartPriceHandler("").pipe(
        Effect.provide(mockAlpaca),
        Effect.provide(mockChartRenderer),
        Effect.provide(mockState()),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("errors when the source returns no points", async () => {
    const emptyMock = Layer.succeed(AlpacaService, {
      getStockSpot: (_symbol: unknown) => Effect.succeed(mockSpotQuote),
      getStockChart: (_symbol: unknown) => Effect.succeed([]),
      getOptionExpirations: (_underlying: string) => Effect.succeed([]),
      getOptionChain: (_symbol: unknown, _expiration: number) => Effect.fail(new HTTPError({ message: "unused" })),
      getForexSpot: (_pair: unknown) => Effect.fail(new HTTPError({ message: "unused" })),
      getForexDaily: (_pair: unknown) => Effect.fail(new HTTPError({ message: "unused" })),
      getFixedIncomeLatestPrices: (_isins: readonly string[]) => Effect.succeed([]),
    });

    const result = await Effect.runPromise(
      chartPriceHandler("AAPL").pipe(
        Effect.provide(emptyMock),
        Effect.provide(mockChartRenderer),
        Effect.provide(mockState()),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });
});
