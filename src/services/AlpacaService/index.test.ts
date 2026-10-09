import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Either, Schema } from "effect";
import {
  FixedIncomePricesRaw,
  ForexHistoricalRatesRaw,
  ForexLatestRatesRaw,
  OptionChainRaw,
  StockBarsRaw,
  StockSnapshotRaw,
  parseOccSymbol,
  toChartPointsFromBars,
  toFixedIncomeQuotes,
  toForexChartPoints,
  toForexQuote,
  toOptionsChain,
  toSpotQuoteFromSnapshot,
} from "./index.ts";

// ── Real API response fixtures (captured from data.alpaca.markets) ──

const stockSnapshotRaw = {
  dailyBar: { c: 336.47, h: 338.6, l: 330.72, n: 30595, o: 331.685, t: "2026-10-09T04:00:00Z", v: 2132531, vw: 334.173843 },
  latestQuote: { ap: 335.99, as: 40, ax: "V", bp: 0.01, bs: 80, bx: "V", c: ["R"], t: "2026-10-09T20:36:06.667843082Z", z: "C" },
  latestTrade: { c: ["@", "T"], i: 30592, p: 335.86, s: 77, t: "2026-10-09T20:29:06.717419438Z", x: "V", z: "C" },
  prevDailyBar: { c: 340.43, h: 341.57, l: 335.935, n: 21983, o: 336.935, t: "2026-10-08T04:00:00Z", v: 1015370, vw: 338.992559 },
};

const stockBarsRaw = {
  bars: [
    { c: 325.03, h: 328.36, l: 323.57, n: 23120, o: 327.01, t: "2026-09-02T04:00:00Z", v: 1152718, vw: 325.306111 },
    { c: 325.25, h: 327.3, l: 314.73, n: 32369, o: 316.97, t: "2026-09-01T04:00:00Z", v: 1709875, vw: 324.030095 },
  ],
  next_page_token: null,
  symbol: "AAPL",
};

const optionChainRaw = {
  next_page_token: null,
  snapshots: {
    "AAPL261009C00110000": {
      dailyBar: { c: 224.9, h: 224.9, l: 224.9, n: 1, o: 224.9, t: "2026-10-07T04:00:00Z", v: 1, vw: 224.9 },
      latestQuote: { ap: 230.11, as: 98, ax: "J", bp: 227.61, bs: 118, bx: "H", c: " ", t: "2026-10-09T19:59:59.790023869Z" },
      latestTrade: { c: "I", p: 224.9, s: 1, t: "2026-10-07T14:07:11.68557285Z", x: "N" },
      prevDailyBar: { c: 228.7, h: 228.7, l: 228.7, n: 1, o: 228.7, t: "2026-09-28T04:00:00Z", v: 1, vw: 228.7 },
    },
    "AAPL261009P00110000": {
      latestQuote: { ap: 0.5, as: 10, ax: "J", bp: 0.4, bs: 20, bx: "H", c: " ", t: "2026-10-09T19:59:59Z" },
      latestTrade: { c: "I", p: 0.45, s: 1, t: "2026-10-09T14:07:11Z", x: "N" },
    },
  },
};

// From the Alpaca docs (USDJPY / EUR pair examples).
const forexLatestRaw = {
  rates: { "EUR/USD": { ap: 1.0871, bp: 1.0869, mp: 1.087, t: "2026-10-09T18:23:41.311530885Z" } },
};

const forexHistoricalRaw = {
  rates: {
    "EUR/USD": [
      { ap: 1.0875, bp: 1.0865, mp: 1.087, t: "2026-10-07T00:00:00Z" },
      { ap: 1.0873, bp: 1.0863, mp: 1.0868, t: "2026-10-08T00:00:00Z" },
    ],
  },
  next_page_token: null,
};

// From the Alpaca docs (fixed_income_latest_prices example).
const fixedIncomeRaw = {
  prices: { US912797KJ59: { p: 99.6459, t: "2025-02-14T20:58:00.648Z", ytm: 4.249, ytw: 4.249 } },
};

// ── OCC symbol parsing ──

describe("parseOccSymbol", () => {
  it("parses a call contract symbol", () => {
    const parsed = parseOccSymbol("AAPL261009C00110000")!;
    expect(parsed.root).toBe("AAPL");
    expect(parsed.type).toBe("call");
    expect(parsed.strike).toBe(110);
    expect(parsed.expiration).toBe(Math.floor(Date.UTC(2026, 9, 9) / 1000));
  });

  it("parses a put contract symbol", () => {
    const parsed = parseOccSymbol("SPY260116P00450000")!;
    expect(parsed.root).toBe("SPY");
    expect(parsed.type).toBe("put");
    expect(parsed.strike).toBe(450);
  });

  it("parses a fractional strike", () => {
    const parsed = parseOccSymbol("AAPL261120C00225500")!;
    expect(parsed.strike).toBe(225.5);
  });

  it("rejects a malformed symbol", () => {
    expect(parseOccSymbol("NOPE")).toBe(null);
    expect(parseOccSymbol("AAPL261009X00110000")).toBe(null);
  });
});

// ── Schema validation ──

describe("Alpaca raw schemas", () => {
  it("decodes a stock snapshot", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(StockSnapshotRaw)(stockSnapshotRaw))).toBe(true);
  });

  it("decodes stock bars", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(StockBarsRaw)(stockBarsRaw))).toBe(true);
  });

  it("decodes an option chain", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(OptionChainRaw)(optionChainRaw))).toBe(true);
  });

  it("decodes forex latest + historical rates", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(ForexLatestRatesRaw)(forexLatestRaw))).toBe(true);
    expect(Either.isRight(Schema.decodeUnknownEither(ForexHistoricalRatesRaw)(forexHistoricalRaw))).toBe(true);
  });

  it("decodes fixed income prices", () => {
    expect(Either.isRight(Schema.decodeUnknownEither(FixedIncomePricesRaw)(fixedIncomeRaw))).toBe(true);
  });

  it("rejects bars with the wrong field type", () => {
    const bad = { bars: [{ ...stockBarsRaw.bars[0], c: "325.03" }] };
    expect(Either.isLeft(Schema.decodeUnknownEither(StockBarsRaw)(bad))).toBe(true);
  });
});

// ── Transformations ──

describe("toSpotQuoteFromSnapshot", () => {
  it("maps a snapshot into a SpotQuote", () => {
    const decoded = Schema.decodeUnknownSync(StockSnapshotRaw)(stockSnapshotRaw);
    const quote = toSpotQuoteFromSnapshot("AAPL", decoded);

    expect(quote.symbol).toBe("AAPL");
    expect(quote.price).toBe(335.86);
    expect(quote.previousClose).toBe(340.43);
    expect(quote.change).toBeCloseTo(-4.57, 2);
    expect(quote.open).toBe(331.685);
    expect(quote.high).toBe(338.6);
    expect(quote.low).toBe(330.72);
    expect(quote.volume).toBe(2132531);
    expect(quote.latestTradingDay).toBe("2026-10-09");
  });
});

describe("toChartPointsFromBars", () => {
  it("maps and sorts bars oldest-first", () => {
    const decoded = Schema.decodeUnknownSync(StockBarsRaw)(stockBarsRaw);
    const points = toChartPointsFromBars(decoded.bars ?? []);

    expect(points.length).toBe(2);
    expect(points[0].date).toBe("2026-09-01");
    expect(points[1].date).toBe("2026-09-02");
    expect(points[1].close).toBe(325.03);
    expect(typeof points[0].timestamp).toBe("number");
  });
});

describe("toOptionsChain", () => {
  it("groups contracts into calls/puts for the requested expiration", () => {
    const decoded = Schema.decodeUnknownSync(OptionChainRaw)(optionChainRaw);
    const expiration = Math.floor(Date.UTC(2026, 9, 9) / 1000);
    const chain = toOptionsChain("AAPL", 226, expiration, decoded.snapshots);

    expect(chain.ticker).toBe("AAPL");
    expect(chain.underlyingPrice).toBe(226);
    expect(chain.calls.length).toBe(1);
    expect(chain.puts.length).toBe(1);

    const call = chain.calls[0];
    expect(call.contractSymbol).toBe("AAPL261009C00110000");
    expect(call.strike).toBe(110);
    expect(call.lastPrice).toBe(224.9);
    expect(call.bid).toBe(227.61);
    expect(call.ask).toBe(230.11);
    expect(call.inTheMoney).toBe(true); // 110 strike < 226 price

    const put = chain.puts[0];
    expect(put.inTheMoney).toBe(false); // 110 strike < 226 price
    // Indicative feed carries no IV; it defaults to 0 rather than NaN.
    expect(call.impliedVolatility).toBe(0);
  });

  it("drops contracts from other expirations", () => {
    const decoded = Schema.decodeUnknownSync(OptionChainRaw)(optionChainRaw);
    const otherExpiration = Math.floor(Date.UTC(2026, 11, 18) / 1000);
    const chain = toOptionsChain("AAPL", 226, otherExpiration, decoded.snapshots);
    expect(chain.calls.length).toBe(0);
    expect(chain.puts.length).toBe(0);
  });
});

describe("toForexQuote", () => {
  it("maps a latest rate into a ForexQuote using the mid price", () => {
    const decoded = Schema.decodeUnknownSync(ForexLatestRatesRaw)(forexLatestRaw);
    const quote = toForexQuote({ from: "EUR", to: "USD", _type: 0 as never }, decoded.rates["EUR/USD"]);

    expect(quote.rate).toBe(1.087);
    expect(quote.bid).toBe(1.0869);
    expect(quote.ask).toBe(1.0871);
    expect(quote.timeZone).toBe("UTC");
  });
});

describe("toForexChartPoints", () => {
  it("maps daily rates to sorted chart points", () => {
    const decoded = Schema.decodeUnknownSync(ForexHistoricalRatesRaw)(forexHistoricalRaw);
    const points = toForexChartPoints(decoded.rates["EUR/USD"]);

    expect(points.length).toBe(2);
    expect(points[0].date).toBe("2026-10-07");
    expect(points[1].close).toBe(1.0868);
  });
});

describe("toFixedIncomeQuotes", () => {
  it("maps priced ISINs into clean quotes", () => {
    const decoded = Schema.decodeUnknownSync(FixedIncomePricesRaw)(fixedIncomeRaw);
    const quotes = toFixedIncomeQuotes(decoded);

    expect(quotes.length).toBe(1);
    expect(quotes[0].isin).toBe("US912797KJ59");
    expect(quotes[0].price).toBe(99.6459);
    expect(quotes[0].yieldToMaturity).toBe(4.249);
  });
});
