import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import {
  forexChartHandler,
  forexChartTitle,
  forexSpotHandler,
  formatRate,
  parsePair,
  rateDecimals,
} from "./alphavantage.ts";
import {
  ForexService,
  type ForexServicePort,
} from "src/services/ForexService/index.ts";
import type { ForexChartPoint, ForexQuote } from "src/services/ForexService/types.ts";
import { ChartRenderer } from "../../StocksMenu/services/ChartRenderer.ts";
import { TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../types.ts";
import { HTTPError } from "../../errors/index.ts";
import type { TerminalUserStateConfig } from "../../types.ts";

// ── Fixtures ──

const mockQuote: ForexQuote = {
  from: "EUR",
  to: "USD",
  fromName: "Euro",
  toName: "United States Dollar",
  rate: 1.11917782,
  bid: 1.11912539,
  ask: 1.11921917,
  lastRefreshed: "2026-10-07 16:00:12",
  timeZone: "UTC",
};

const point = (date: string, close: number): ForexChartPoint => ({
  date,
  open: close,
  high: close,
  low: close,
  close,
  timestamp: new Date(date).getTime(),
});

const mockPoints: ForexChartPoint[] = [
  point("2026-10-02", 1.1253),
  point("2026-10-05", 1.1221),
  point("2026-10-06", 1.1258),
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
    coinmarketcap: undefined,
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
  },
  scriptContext: {},
};

// ── Mock layers ──

const mockForex: Layer.Layer<ForexService> = Layer.succeed(ForexService, {
  getSpot: (_pair) => Effect.succeed(mockQuote),
  getDaily: (_pair) => Effect.succeed(mockPoints),
} satisfies ForexServicePort);

/** Chart renderer that records the data/title it was handed. */
const spyChart = (calls: { data: Record<string, unknown>[]; title?: string }[]) =>
  Layer.succeed(ChartRenderer, {
    render: (
      data: Record<string, unknown>[],
      _x: string,
      _y: string,
      title?: string,
    ) => {
      calls.push({ data, title });
      return Effect.void;
    },
    renderTechnical: (_data, _x, _y, _overlays, _title) => Effect.void,
  });

/**
 * A chart renderer used on paths that error before charting. The handler's
 * static type still requires `ChartRenderer`, so every invocation must supply
 * a layer even when rendering never actually happens.
 */
const noopChart = Layer.succeed(ChartRenderer, {
  render: () => Effect.void,
  renderTechnical: () => Effect.void,
});

const mockState = (overrides?: Partial<TerminalUserStateConfig>) =>
  Layer.succeed(TerminalUserStateConfigContext, { ...baseState, ...overrides });

// A range that covers exactly the 2026-10-05 and 2026-10-06 points.
const rangeFrom = "2026-10-05";
const rangeTo = "2026-10-06";

// ── parsePair ──

describe("parsePair", () => {
  it("upper-cases and trims valid 3-letter codes", () => {
    expect(parsePair(" eur ", "usd")).toEqual({ from: "EUR", to: "USD" });
  });

  it("rejects missing, malformed, or identical codes", () => {
    expect(parsePair(undefined, "USD")).toBe(null);
    expect(parsePair("EUR", undefined)).toBe(null);
    expect(parsePair("EURO", "USD")).toBe(null);
    expect(parsePair("EUR", "EUR")).toBe(null);
  });
});

// ── spot handler ──

describe("forexSpotHandler", () => {
  it("returns a realtime quote for a valid pair", async () => {
    const result = await Effect.runPromise(
      forexSpotHandler("EUR", "USD").pipe(
        Effect.provide(mockForex),
        Effect.provide(mockState()),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("passes the upper-cased pair to the service", async () => {
    const seen: string[] = [];
    const spy = Layer.succeed(ForexService, {
      getSpot: (pair) => {
        seen.push(`${pair.from}/${pair.to}`);
        return Effect.succeed(mockQuote);
      },
      getDaily: (_pair) => Effect.succeed(mockPoints),
    } satisfies ForexServicePort);

    await Effect.runPromise(
      forexSpotHandler("eur", "usd").pipe(
        Effect.provide(spy),
        Effect.provide(mockState()),
      ),
    );
    expect(seen[0]).toBe("EUR/USD");
  });

  it("errors without calling the service when the pair is incomplete", async () => {
    let called = false;
    const spy = Layer.succeed(ForexService, {
      getSpot: (_pair) => {
        called = true;
        return Effect.succeed(mockQuote);
      },
      getDaily: (_pair) => Effect.succeed(mockPoints),
    } satisfies ForexServicePort);

    const result = await Effect.runPromise(
      forexSpotHandler("EUR").pipe(
        Effect.provide(spy),
        Effect.provide(mockState()),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
    expect(called).toBe(false);
  });

  it("propagates service errors as ProgramError", async () => {
    const failing = Layer.succeed(ForexService, {
      getSpot: (_pair) => Effect.fail(new HTTPError({ message: "API down" })),
      getDaily: (_pair) => Effect.succeed(mockPoints),
    } satisfies ForexServicePort);

    await expect(
      Effect.runPromise(
        forexSpotHandler("EUR", "USD").pipe(
          Effect.provide(failing),
          Effect.provide(mockState()),
        ),
      ),
    ).rejects.toThrow();
  });
});

// ── chart handler ──

describe("forexChartHandler", () => {
  it("defaults to the trailing year and charts the pair", async () => {
    const calls: { data: Record<string, unknown>[]; title?: string }[] = [];
    const result = await Effect.runPromise(
      forexChartHandler("EUR", "USD").pipe(
        Effect.provide(mockForex),
        Effect.provide(spyChart(calls)),
        Effect.provide(mockState()),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
    expect(calls.length).toBe(1);
    // Title labels the pair and the resolved range.
    expect(calls[0].title?.startsWith("EUR/USD FX - ")).toBe(true);
    expect(calls[0].title?.includes(" to ")).toBe(true);
  });

  it("filters points to exactly the requested from/to range", async () => {
    const calls: { data: Record<string, unknown>[]; title?: string }[] = [];
    const result = await Effect.runPromise(
      forexChartHandler("EUR", "USD", rangeFrom, rangeTo).pipe(
        Effect.provide(mockForex),
        Effect.provide(spyChart(calls)),
        Effect.provide(mockState()),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
    const dates = calls[0].data.map((d) => d.date);
    expect(dates).toEqual(["2026-10-05", "2026-10-06"]);
    expect(calls[0].title).toBe("EUR/USD FX - 2026-10-05 to 2026-10-06");
  });

  it("errors on a malformed date without calling the service", async () => {
    let called = false;
    const spy = Layer.succeed(ForexService, {
      getSpot: (_pair) => Effect.succeed(mockQuote),
      getDaily: (_pair) => {
        called = true;
        return Effect.succeed(mockPoints);
      },
    } satisfies ForexServicePort);

    const result = await Effect.runPromise(
      forexChartHandler("EUR", "USD", "01/01/2026").pipe(
        Effect.provide(spy),
        Effect.provide(noopChart),
        Effect.provide(mockState()),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
    expect(called).toBe(false);
  });

  it("errors when from is after to", async () => {
    const result = await Effect.runPromise(
      forexChartHandler("EUR", "USD", "2026-05-01", "2026-01-01").pipe(
        Effect.provide(mockForex),
        Effect.provide(noopChart),
        Effect.provide(mockState()),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
  });

  it("errors when the range contains no data", async () => {
    const calls: { data: Record<string, unknown>[]; title?: string }[] = [];
    const result = await Effect.runPromise(
      forexChartHandler("EUR", "USD", "2020-01-01", "2020-02-01").pipe(
        Effect.provide(mockForex),
        Effect.provide(spyChart(calls)),
        Effect.provide(mockState()),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
    // The chart must not be rendered for an empty range.
    expect(calls.length).toBe(0);
  });

  it("errors on an invalid pair without calling the service", async () => {
    let called = false;
    const spy = Layer.succeed(ForexService, {
      getSpot: (_pair) => Effect.succeed(mockQuote),
      getDaily: (_pair) => {
        called = true;
        return Effect.succeed(mockPoints);
      },
    } satisfies ForexServicePort);

    const result = await Effect.runPromise(
      forexChartHandler("EUR", "EURO").pipe(
        Effect.provide(spy),
        Effect.provide(noopChart),
        Effect.provide(mockState()),
      ),
    );
    expect(result.result.type).toBe(CommandResultType.Error);
    expect(called).toBe(false);
  });

  it("propagates service errors as ProgramError", async () => {
    const failing = Layer.succeed(ForexService, {
      getSpot: (_pair) => Effect.succeed(mockQuote),
      getDaily: (_pair) => Effect.fail(new HTTPError({ message: "API down" })),
    } satisfies ForexServicePort);

    await expect(
      Effect.runPromise(
        forexChartHandler("EUR", "USD").pipe(
          Effect.provide(failing),
          Effect.provide(noopChart),
          Effect.provide(mockState()),
        ),
      ),
    ).rejects.toThrow();
  });
});

// ── title helper ──

describe("forexChartTitle", () => {
  it("labels the pair and the inclusive date range", () => {
    expect(forexChartTitle("EUR/USD", "2025-10-07", "2026-10-07"))
      .toBe("EUR/USD FX - 2025-10-07 to 2026-10-07");
  });
});

describe("formatRate", () => {
  it("keeps four decimals for majors", () => {
    expect(formatRate(1.0854)).toBe("1.0854");
    expect(formatRate(152.3412)).toBe("152.3412");
  });

  it("adds decimals for a JPY cross so the price keeps its digits", () => {
    // JPY/USD trades near 0.0065 — four decimals would show 0.0065 and drop the
    // rest of the quote.
    expect(formatRate(0.0065123)).toBe("0.0065123");
    // Sub-0.001 rates (KRW, IDR) get two more digits still.
    expect(formatRate(-0.0003123)).toBe("-0.00031230");
  });

  it("falls back to four decimals for zero", () => {
    expect(formatRate(0)).toBe("0.0000");
  });

  it("quotes a delta at the price's own precision", () => {
    // The chart prints the change beside the latest close, so both must share a
    // precision — otherwise 0.0063200 sits next to -0.00026000.
    const decimals = rateDecimals(0.00632);
    expect(decimals).toBe(7);
    expect(formatRate(-0.00026, decimals)).toBe("-0.0002600");
  });
});

describe("parsePair", () => {
  it("accepts a JPY cross in either direction", () => {
    expect(parsePair("JPY", "USD")).toEqual({ from: "JPY", to: "USD" });
    expect(parsePair("usd", "jpy")).toEqual({ from: "USD", to: "JPY" });
  });

  it("rejects a concatenated pair", () => {
    expect(parsePair("JPYUSD", undefined)).toBe(null);
  });
});
