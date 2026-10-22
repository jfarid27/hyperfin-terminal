import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import {
  bollingerHandler,
  fibonacciHandler,
  fxLevelLabel,
  returnsHandler,
  toSeriesPoints,
  trailingYear,
} from "./technicals.ts";
import type { SeriesPoint } from "../../../technicals/index.ts";
import { technicalsMenuOptions } from "../TechnicalsMenu/menu.ts";
import { ForexService } from "src/services/ForexService/index.ts";
import { AlpacaService } from "src/services/AlpacaService/index.ts";
import type { ForexChartPoint } from "src/services/ForexService/types.ts";
import type { ForexDataSourceType } from "src/services/ForexService/types.ts";
import type { ChartPoint, SpotQuote } from "src/services/AlphaVantageService/index.ts";
import type { OptionsChain } from "src/services/OptionsService/types.ts";
import { ChartRenderer } from "../../StocksMenu/services/ChartRenderer.ts";
import { TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../types.ts";
import { HTTPError } from "../../errors/index.ts";
import type { TerminalUserStateConfig } from "../../types.ts";

// ── Fixtures ──

/** 40 daily FX bars with a gentle wave, so the indicators have a real swing. */
const fxBars: ForexChartPoint[] = Array.from({ length: 40 }, (_, i) => {
  const close = 1.08 + Math.sin(i / 4) * 0.01 + i * 0.0005;
  const timestamp = Date.UTC(2026, 0, 1 + i);
  return {
    date: new Date(timestamp).toISOString().slice(0, 10),
    open: close,
    high: close,
    low: close,
    close,
    timestamp,
  };
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
    coinmarketcap: undefined,
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
    forex: { datasource: DataSourceType.AlphaVantage },
  },
  scriptContext: {},
};

// ── Mock layers ──

const mockForex = (points: ForexChartPoint[] = fxBars) =>
  Layer.succeed(ForexService, {
    getSpot: (_pair) => Effect.fail(new HTTPError({ message: "unused" })),
    getDaily: (_pair) => Effect.succeed(points),
  });

const mockAlpaca = (points: ForexChartPoint[] = fxBars) =>
  Layer.succeed(AlpacaService, {
    getStockSpot: (_symbol) => Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<SpotQuote, HTTPError>,
    getStockChart: (_symbol) => Effect.succeed([] as ChartPoint[]),
    getOptionExpirations: (_underlying) => Effect.succeed([]),
    getOptionChain: (_symbol, _expiration) =>
      Effect.fail(new HTTPError({ message: "unused" })) as Effect.Effect<OptionsChain, HTTPError>,
    getForexSpot: (_pair) => Effect.fail(new HTTPError({ message: "unused" })),
    getForexDaily: (_pair) => Effect.succeed(points),
    getFixedIncomeLatestPrices: (_isins) => Effect.succeed([]),
  });

const captured: { overlays: unknown[]; title?: string; yLabel?: string; primary?: unknown[] }[] = [];
const spyRenderer = Layer.succeed(ChartRenderer, {
  render: (_data, _x, _y) => Effect.void,
  renderTechnical: (_data, _x, _y, overlays, title, yLabel, primary) => {
    captured.push({ overlays, title, yLabel, primary });
    return Effect.void;
  },
});

const mockState = (datasource: ForexDataSourceType = DataSourceType.AlphaVantage) =>
  Layer.succeed(TerminalUserStateConfigContext, {
    ...baseState,
    loadedContext: {
      ...baseState.loadedContext,
      forex: { datasource },
    },
  });

const layer = (
  opts: {
    forex?: ForexChartPoint[];
    alpaca?: ForexChartPoint[];
    datasource?: ForexDataSourceType;
  } = {},
) =>
  Layer.mergeAll(
    mockForex(opts.forex),
    mockAlpaca(opts.alpaca),
    spyRenderer,
    mockState(opts.datasource),
  );

// ── Helpers ──

describe("forex technicals — helpers", () => {
  it("coerces bars to close-valued points, dropping non-finite rows and sorting", () => {
    const unsorted: ForexChartPoint[] = [
      { ...fxBars[1], close: 1.09 },
      { ...fxBars[0], close: Number.NaN },
      { ...fxBars[2], close: 1.10 },
    ];

    const points = toSeriesPoints(unsorted);

    expect(points.length).toBe(2);
    expect(points[0].timestamp).toBe(fxBars[1].timestamp);
    expect(points[0].value).toBe(1.09);
    expect(points[1].value).toBe(1.10);
  });

  it("keeps only the trailing year, anchored to the newest bar", () => {
    // Two years of daily bars; the window runs back one year from the last one.
    const twoYears: SeriesPoint[] = Array.from({ length: 730 }, (_, i) => ({
      timestamp: Date.UTC(2024, 0, 1) + i * 86_400_000,
      value: 1,
    }));

    const window = trailingYear(twoYears);

    expect(window.length).toBe(366);
    expect(window[window.length - 1]).toBe(twoYears[twoYears.length - 1]);
    expect(trailingYear([]).length).toBe(0);
  });

  it("labels rates at FX precision, not at two decimals", () => {
    // The shared default would render all three as "1.09"/"1.08"/"1.09".
    expect(fxLevelLabel(1.0867)).toBe("1.0867");
    expect(fxLevelLabel(1.0853)).toBe("1.0853");
    expect(fxLevelLabel(1.0854)).toBe("1.0854");
    // A JPY cross needs the extra digits the magnitude calls for.
    expect(fxLevelLabel(0.0064773)).toBe("0.0064773");
  });
});

describe("forex technicals submenu definition", () => {
  it("lists bbands, fibonacci and returns with the pair first", () => {
    const options = technicalsMenuOptions(baseState);
    const commands = new Map(options.map((o) => [o.name, o.command]));

    expect(commands.get("bbands")).toBe("bbands [from] [to] [period] [stddev]");
    expect(commands.get("fibonacci")).toBe("fibonacci [from] [to] [lookback]");
    expect(commands.get("returns")).toBe("returns [from] [to]");
  });

  it("keeps every argument optional so a bare command reaches the handler's guard", () => {
    for (const option of technicalsMenuOptions(baseState)) {
      expect(option.command.includes("<")).toBe(false);
    }
  });

  it("keeps the exit and back options so the submenu is escapable", () => {
    const commands = technicalsMenuOptions(baseState).map((o) => o.command);
    expect(commands).toContain("back");
    expect(commands).toContain("exit");
  });
});

describe("forex bollingerHandler", () => {
  it("charts the envelope from the AlphaVantage daily rate", async () => {
    captured.length = 0;
    const state = await Effect.runPromise(
      bollingerHandler("EUR", "USD").pipe(Effect.provide(layer())),
    );

    expect(state.result.type).toBe(CommandResultType.Success);
    expect(captured.length).toBe(1);
    expect(captured[0].title).toBe("EUR/USD Bollinger Bands (20, 2)");
    // Envelope + mid line: the overlay set is a shaded area and three lines.
    expect(captured[0].overlays.length).toBe(4);
  });

  it("honours an explicit period and stddev", async () => {
    captured.length = 0;
    await Effect.runPromise(
      bollingerHandler("EUR", "USD", "10", "3").pipe(Effect.provide(layer())),
    );

    expect(captured[0].title).toBe("EUR/USD Bollinger Bands (10, 3)");
  });

  it("uses Alpaca's daily history when that is the active source", async () => {
    captured.length = 0;
    const state = await Effect.runPromise(
      bollingerHandler("EUR", "USD").pipe(
        // Empty AlphaVantage would fail, so success proves the Alpaca branch ran.
        Effect.provide(layer({ forex: [], datasource: DataSourceType.Alpaca })),
      ),
    );

    expect(state.result.type).toBe(CommandResultType.Success);
    expect(captured[0].title).toBe("EUR/USD Bollinger Bands (20, 2)");
  });

  it("errors without charting when the pair is incomplete or self-paired", async () => {
    captured.length = 0;
    for (const [from, to] of [["EUR", undefined], ["EUR", "EUR"], [undefined, "USD"]] as const) {
      const state = await Effect.runPromise(
        bollingerHandler(from, to).pipe(Effect.provide(layer())),
      );
      expect(state.result.type).toBe(CommandResultType.Error);
    }
    expect(captured.length).toBe(0);
  });

  it("errors when the source returns no bars at all", async () => {
    captured.length = 0;
    const state = await Effect.runPromise(
      bollingerHandler("EUR", "USD").pipe(Effect.provide(layer({ forex: [] }))),
    );

    expect(state.result.type).toBe(CommandResultType.Error);
    expect(captured.length).toBe(0);
  });

  it("errors when the series is shorter than the requested window", async () => {
    captured.length = 0;
    const state = await Effect.runPromise(
      bollingerHandler("EUR", "USD", "200").pipe(
        Effect.provide(layer({ forex: fxBars.slice(0, 5) })),
      ),
    );

    expect(state.result.type).toBe(CommandResultType.Error);
    expect(captured.length).toBe(0);
  });
});

describe("forex fibonacciHandler", () => {
  it("charts retracement levels over the pair's swing", async () => {
    captured.length = 0;
    const state = await Effect.runPromise(
      fibonacciHandler("EUR", "USD").pipe(Effect.provide(layer())),
    );

    expect(state.result.type).toBe(CommandResultType.Success);
    expect(captured[0].title).toContain("EUR/USD Fibonacci Retracement");
    // Each level draws a rule plus two labels.
    expect(captured[0].overlays.length).toBeGreaterThan(0);
  });

  it("narrows the swing to the requested lookback", async () => {
    captured.length = 0;
    await Effect.runPromise(
      fibonacciHandler("EUR", "USD", "12").pipe(Effect.provide(layer())),
    );

    expect(captured[0].title).toBe("EUR/USD Fibonacci Retracement (12 bars)");
  });

  it("errors without charting when the pair is missing", async () => {
    captured.length = 0;
    const state = await Effect.runPromise(
      fibonacciHandler().pipe(Effect.provide(layer())),
    );

    expect(state.result.type).toBe(CommandResultType.Error);
    expect(captured.length).toBe(0);
  });
});

describe("forex returnsHandler", () => {
  it("charts the daily percent returns as sign-coloured bars", async () => {
    captured.length = 0;
    const state = await Effect.runPromise(
      returnsHandler("EUR", "USD").pipe(Effect.provide(layer())),
    );

    expect(state.result.type).toBe(CommandResultType.Success);
    expect(captured[0].title).toBe("EUR/USD Daily Returns");
    expect(captured[0].yLabel).toBe("Return (%)");
    // Two rect marks — one for up days, one for down days — plus the baselines.
    expect(captured[0].primary?.length).toBe(2);
    expect(captured[0].overlays.length).toBeGreaterThan(0);
  });

  it("errors when the series cannot produce a single return", async () => {
    captured.length = 0;
    const state = await Effect.runPromise(
      returnsHandler("EUR", "USD").pipe(Effect.provide(layer({ forex: fxBars.slice(0, 1) }))),
    );

    expect(state.result.type).toBe(CommandResultType.Error);
    expect(captured.length).toBe(0);
  });
});
