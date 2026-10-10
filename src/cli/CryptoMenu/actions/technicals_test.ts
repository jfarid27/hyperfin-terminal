import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { bollingerHandler, fibonacciHandler, parseNonNegative, parseOptionalPositiveInt, parsePositiveInt, lookbackDaysFor } from "./technicals.ts";
import { CoinGeckoModel } from "../model/index.ts";
import { technicalsMenuOptions } from "../TechnicalsMenu/menu.ts";
import { ChartRenderer } from "../../StocksMenu/services/ChartRenderer.ts";
import { TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../types.ts";
import { HTTPError } from "../../errors/index.ts";
import type { TerminalUserStateConfig } from "../../types.ts";
import type { ChartData } from "src/services/CryptoService/types.ts";

// ── Fixtures ──

/** A daily-ish price series with a clear up move, long enough for 20-bar bands. */
const prices = Array.from({ length: 40 }, (_, i) => ({
  timestamp: Date.UTC(2026, 0, 1 + i),
  price: 100 + Math.sin(i / 4) * 8 + i * 0.7,
}));

const mockChartData = (series = prices): ChartData => ({
  symbol: { name: "bitcoin", id: "bitcoin", _type: DataSourceType.CoinGecko },
  prices: series,
});

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
    crypto: { symbol: "bitcoin", datasource: DataSourceType.CoinGecko },
  },
  scriptContext: {},
};

// ── Mock layers ──

const mockModel = (series = prices) =>
  Layer.succeed(CoinGeckoModel, {
    spot: { get: (_symbol) => Effect.succeed({ symbol: mockChartData().symbol, price: 1 }) },
    chart: { get: (_symbol) => Effect.succeed(mockChartData(series)) },
  });

/** Records every overlay handed to the renderer so band/level marks can be inspected. */
const spyRenderer = (captured: { overlays: unknown[]; title?: string }[]) =>
  Layer.succeed(ChartRenderer, {
    render: (_data, _x, _y) => Effect.void,
    renderTechnical: (_data, _x, _y, overlays, title) => {
      captured.push({ overlays, title });
      return Effect.void;
    },
  });

const mockState = (overrides?: Partial<TerminalUserStateConfig>) =>
  Layer.succeed(TerminalUserStateConfigContext, { ...baseState, ...overrides });

// ── Tests ──

describe("crypto technicals — parameter parsing", () => {
  it("parses positive integers and falls back on junk", () => {
    expect(parsePositiveInt("14", 20)).toBe(14);
    expect(parsePositiveInt(undefined, 20)).toBe(20);
    expect(parsePositiveInt("", 20)).toBe(20);
    expect(parsePositiveInt("abc", 20)).toBe(20);
    expect(parsePositiveInt("0", 20), "zero is not a usable period").toBe(20);
    expect(parsePositiveInt("-5", 20)).toBe(20);
    expect(parsePositiveInt("2.5", 20)).toBe(20);
  });

  it("returns undefined for an absent or malformed optional integer", () => {
    expect(parseOptionalPositiveInt("30")).toBe(30);
    expect(parseOptionalPositiveInt(undefined)).toBe(undefined);
    expect(parseOptionalPositiveInt("nope")).toBe(undefined);
  });

  it("accepts zero and decimals for a non-negative deviation", () => {
    expect(parseNonNegative("2.5", 2)).toBe(2.5);
    expect(parseNonNegative("0", 2), "zero deviations is degenerate but valid").toBe(0);
    expect(parseNonNegative("-1", 2)).toBe(2);
    expect(parseNonNegative("x", 2)).toBe(2);
  });

  it("requests enough daily history for the indicator's lookback", () => {
    // The plain chart command asks for 14 days, which cannot fill a 20-bar
    // Bollinger window — technicals must ask for more.
    expect(Number(lookbackDaysFor(20))).toBeGreaterThanOrEqual(20);
    expect(Number(lookbackDaysFor(20))).toBeGreaterThanOrEqual(180);
    expect(Number(lookbackDaysFor(200)), "clamped to CoinGecko's 365-day cap").toBe(365);
    // Never below the default even with no lookback supplied.
    expect(Number(lookbackDaysFor(0))).toBeGreaterThanOrEqual(180);
  });
});

describe("crypto technicals submenu definition", () => {
  it("lists bbands and fibonacci with chart-style parameters", () => {
    const options = technicalsMenuOptions(baseState);

    const bbands = options.find((o) => o.name === "bbands");
    const fibonacci = options.find((o) => o.name === "fibonacci");

    expect(bbands, "the bbands option is present").toBeDefined();
    expect(fibonacci, "the fibonacci option is present").toBeDefined();
    // The parameter structure mirrors `chart`: an optional leading symbol that
    // falls back to the loaded token, then the indicator's own arguments.
    expect(bbands!.command).toBe("bbands [symbol] [period] [stddev]");
    expect(fibonacci!.command).toBe("fibonacci [symbol] [lookback]");
  });

  it("keeps the back option so the submenu is escapable", () => {
    const options = technicalsMenuOptions(baseState);
    expect(options.some((o) => o.name === "back")).toBe(true);
  });
});

describe("crypto bollingerHandler", () => {
  it("charts the envelope and succeeds on a sufficient series", async () => {
    const captured: { overlays: unknown[]; title?: string }[] = [];
    const result = await Effect.runPromise(
      bollingerHandler("bitcoin").pipe(
        Effect.provide(mockModel()),
        Effect.provide(spyRenderer(captured)),
        Effect.provide(mockState()),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured.length, "the chart renderer was called once").toBe(1);
    expect(captured[0].overlays.length, "band + mid/edge lines are drawn").toBe(4);
    expect(captured[0].title).toContain("Bollinger Bands (20, 2)");
  });

  it("respects an explicit period and deviation", async () => {
    const captured: { overlays: unknown[]; title?: string }[] = [];
    await Effect.runPromise(
      bollingerHandler("bitcoin", "10", "3").pipe(
        Effect.provide(mockModel()),
        Effect.provide(spyRenderer(captured)),
        Effect.provide(mockState()),
      ),
    );

    expect(captured[0].title).toContain("Bollinger Bands (10, 3)");
  });

  it("falls back to the loaded crypto token when no symbol is given", async () => {
    const captured: { overlays: unknown[]; title?: string }[] = [];
    const result = await Effect.runPromise(
      bollingerHandler().pipe(
        Effect.provide(mockModel()),
        Effect.provide(spyRenderer(captured)),
        Effect.provide(mockState()),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured[0].title).toContain("BITCOIN");
  });

  it("errors when there is no symbol and no loaded token", async () => {
    const noToken = {
      ...baseState,
      loadedContext: {
        ...baseState.loadedContext,
        crypto: { datasource: DataSourceType.CoinGecko },
      },
    };

    const result = await Effect.runPromise(
      bollingerHandler().pipe(
        Effect.provide(mockModel()),
        Effect.provide(spyRenderer([])),
        Effect.provide(mockState(noToken)),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("errors rather than charting when the series is shorter than the period", async () => {
    const captured: { overlays: unknown[]; title?: string }[] = [];
    const short = prices.slice(0, 5);

    const result = await Effect.runPromise(
      bollingerHandler("bitcoin", "20").pipe(
        Effect.provide(mockModel(short)),
        Effect.provide(spyRenderer(captured)),
        Effect.provide(mockState()),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Error);
    expect(captured.length, "no chart is drawn without bands").toBe(0);
  });

  it("propagates model failures as ProgramError", async () => {
    const failing = Layer.succeed(CoinGeckoModel, {
      spot: { get: (_symbol) => Effect.fail(new HTTPError({ message: "down" })) },
      chart: { get: (_symbol) => Effect.fail(new HTTPError({ message: "down" })) },
    });

    await expect(
      Effect.runPromise(
        bollingerHandler("bitcoin").pipe(
          Effect.provide(failing),
          Effect.provide(spyRenderer([])),
          Effect.provide(mockState()),
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("crypto fibonacciHandler", () => {
  it("charts the retracement levels over the whole series by default", async () => {
    const captured: { overlays: unknown[]; title?: string }[] = [];
    const result = await Effect.runPromise(
      fibonacciHandler("bitcoin").pipe(
        Effect.provide(mockModel()),
        Effect.provide(spyRenderer(captured)),
        Effect.provide(mockState()),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(captured[0].overlays.length, "one rule + one label per edge").toBe(3);
    expect(captured[0].title).toContain("Fibonacci Retracement (40 bars)");
  });

  it("narrows the swing to the requested lookback", async () => {
    const captured: { overlays: unknown[]; title?: string }[] = [];
    await Effect.runPromise(
      fibonacciHandler("bitcoin", "10").pipe(
        Effect.provide(mockModel()),
        Effect.provide(spyRenderer(captured)),
        Effect.provide(mockState()),
      ),
    );

    expect(captured[0].title).toContain("Fibonacci Retracement (10 bars)");
  });

  it("errors when the series has no swing to retrace", async () => {
    const flat = Array.from({ length: 10 }, (_, i) => ({
      timestamp: Date.UTC(2026, 0, 1 + i),
      price: 42,
    }));

    const result = await Effect.runPromise(
      fibonacciHandler("bitcoin").pipe(
        Effect.provide(mockModel(flat)),
        Effect.provide(spyRenderer([])),
        Effect.provide(mockState()),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Error);
  });
});
