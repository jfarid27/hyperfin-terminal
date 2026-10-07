import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Either, Schema } from "effect";
import {
  filterPointsByRange,
  ForexQuoteRaw,
  FxDailyRaw,
  resolveDateRange,
  toForexChartPoints,
  toForexQuote,
} from "./index.ts";

// ── Real API response fixtures (from curl against EUR/USD, 2026-10-07) ──

const validQuoteRaw = {
  "Realtime Currency Exchange Rate": {
    "1. From_Currency Code": "EUR",
    "2. From_Currency Name": "Euro",
    "3. To_Currency Code": "USD",
    "4. To_Currency Name": "United States Dollar",
    "5. Exchange Rate": "1.11917782",
    "6. Last Refreshed": "2026-10-07 16:00:12",
    "7. Time Zone": "UTC",
    "8. Bid Price": "1.11912539",
    "9. Ask Price": "1.11921917",
  },
};

const validDailyRaw = {
  "Meta Data": {
    "1. Information": "Forex Daily Prices (open, high, low, close)",
    "2. From Symbol": "EUR",
    "3. To Symbol": "USD",
    "4. Output Size": "Full size",
    "5. Last Refreshed": "2026-10-06",
    "6. Time Zone": "UTC",
  },
  "Time Series FX (Daily)": {
    "2026-10-06": { "1. open": "1.12190", "2. high": "1.12760", "3. low": "1.12010", "4. close": "1.12580" },
    "2026-10-05": { "1. open": "1.12470", "2. high": "1.12610", "3. low": "1.11600", "4. close": "1.12210" },
    "2026-10-02": { "1. open": "1.12390", "2. high": "1.12850", "3. low": "1.12200", "4. close": "1.12530" },
  },
};

// A rate-limited / notice response: no payload, just a message.
const noticeRaw = {
  Information:
    "We have detected your API key as ... and our standard API rate limit is 25 requests per day.",
};

// ── Schema validation ──

describe("ForexQuoteRaw schema", () => {
  it("validates a real CURRENCY_EXCHANGE_RATE response", () => {
    const result = Schema.decodeUnknownEither(ForexQuoteRaw)(validQuoteRaw);
    expect(Either.isRight(result), "valid quote response should decode").toBe(true);
  });

  it("decodes a notice response with no payload", () => {
    const result = Schema.decodeUnknownEither(ForexQuoteRaw)(noticeRaw);
    expect(Either.isRight(result), "notice response should decode").toBe(true);
    if (Either.isRight(result)) {
      expect(result.right["Realtime Currency Exchange Rate"]).toBeUndefined();
      expect(result.right.Information).toBeDefined();
    }
  });

  it("rejects a payload with wrong field types", () => {
    const bad = {
      "Realtime Currency Exchange Rate": {
        ...validQuoteRaw["Realtime Currency Exchange Rate"],
        "5. Exchange Rate": 1.11917782, // number, not string
      },
    };
    const result = Schema.decodeUnknownEither(ForexQuoteRaw)(bad);
    expect(Either.isLeft(result), "wrong type should fail").toBe(true);
  });
});

describe("FxDailyRaw schema", () => {
  it("validates a real FX_DAILY response", () => {
    const result = Schema.decodeUnknownEither(FxDailyRaw)(validDailyRaw);
    expect(Either.isRight(result), "valid daily response should decode").toBe(true);
  });

  it("decodes a notice response with no time series", () => {
    const result = Schema.decodeUnknownEither(FxDailyRaw)(noticeRaw);
    expect(Either.isRight(result), "notice response should decode").toBe(true);
    if (Either.isRight(result)) {
      expect(result.right["Time Series FX (Daily)"]).toBeUndefined();
    }
  });

  it("rejects a malformed daily entry", () => {
    const bad = {
      "Time Series FX (Daily)": {
        "2026-10-06": { "1. open": "1.12190", "2. high": "1.12760", "3. low": "1.12010", "4. close": 1.1258 },
      },
    };
    const result = Schema.decodeUnknownEither(FxDailyRaw)(bad);
    expect(Either.isLeft(result), "wrong type in entry should fail").toBe(true);
  });
});

// ── Transformations ──

describe("toForexQuote", () => {
  it("transforms a raw rate response into a clean ForexQuote", () => {
    const decoded = Schema.decodeUnknownSync(ForexQuoteRaw)(validQuoteRaw);
    const quote = toForexQuote(decoded["Realtime Currency Exchange Rate"]!);

    expect(quote.from).toBe("EUR");
    expect(quote.to).toBe("USD");
    expect(quote.fromName).toBe("Euro");
    expect(quote.toName).toBe("United States Dollar");
    expect(quote.rate).toBe(1.11917782);
    expect(quote.bid).toBe(1.11912539);
    expect(quote.ask).toBe(1.11921917);
    expect(quote.lastRefreshed).toBe("2026-10-07 16:00:12");
    expect(quote.timeZone).toBe("UTC");
  });

  it("converts numeric fields from strings to numbers", () => {
    const decoded = Schema.decodeUnknownSync(ForexQuoteRaw)(validQuoteRaw);
    const quote = toForexQuote(decoded["Realtime Currency Exchange Rate"]!);
    expect(typeof quote.rate).toBe("number");
    expect(typeof quote.bid).toBe("number");
    expect(typeof quote.ask).toBe("number");
  });
});

describe("toForexChartPoints", () => {
  it("transforms a raw response into sorted, numeric points", () => {
    const decoded = Schema.decodeUnknownSync(FxDailyRaw)(validDailyRaw);
    const points = toForexChartPoints(decoded);

    expect(points.length).toBe(3);
    expect(points[0].date).toBe("2026-10-02");
    expect(points[1].date).toBe("2026-10-05");
    expect(points[2].date).toBe("2026-10-06");
    expect(points[2].close).toBe(1.1258);
    expect(typeof points[0].open).toBe("number");
    expect(typeof points[0].timestamp).toBe("number");
  });

  it("returns an empty list when no time series is present", () => {
    const decoded = Schema.decodeUnknownSync(FxDailyRaw)(noticeRaw);
    expect(toForexChartPoints(decoded).length).toBe(0);
  });
});

// ── Date-range resolution ──

const NOW = new Date("2026-10-07T12:00:00Z");

describe("resolveDateRange", () => {
  it("defaults to the trailing year when no dates are given", () => {
    const range = resolveDateRange(undefined, undefined, NOW)!;
    expect(new Date(range.start).toISOString().slice(0, 10)).toBe("2025-10-07");
    expect(new Date(range.end).toISOString().slice(0, 10)).toBe("2026-10-07");
  });

  it("ranges from <from> to today when only <from> is given", () => {
    const range = resolveDateRange("2026-01-01", undefined, NOW)!;
    expect(new Date(range.start).toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(new Date(range.end).toISOString().slice(0, 10)).toBe("2026-10-07");
  });

  it("uses the exact from/to dates when both are given", () => {
    const range = resolveDateRange("2026-01-01", "2026-03-01", NOW)!;
    expect(new Date(range.start).toISOString().slice(0, 10)).toBe("2026-01-01");
    // The end day is inclusive, so it lands at the very end of 2026-03-01.
    expect(new Date(range.end).toISOString().slice(0, 10)).toBe("2026-03-01");
  });

  it("rejects a malformed date", () => {
    expect(resolveDateRange("01/01/2026", undefined, NOW)).toBe(null);
    expect(resolveDateRange(undefined, "not-a-date", NOW)).toBe(null);
  });

  it("rejects a date that rolls over (2026-02-31)", () => {
    expect(resolveDateRange("2026-02-31", undefined, NOW)).toBe(null);
  });

  it("rejects a range where from is after to", () => {
    expect(resolveDateRange("2026-05-01", "2026-01-01", NOW)).toBe(null);
  });
});

describe("filterPointsByRange", () => {
  const points = Schema.decodeUnknownSync(FxDailyRaw)(validDailyRaw);
  const parsed = toForexChartPoints(points);

  it("keeps points inside the inclusive range", () => {
    const range = resolveDateRange("2026-10-05", "2026-10-06", NOW)!;
    const kept = filterPointsByRange(parsed, range);
    expect(kept.map((p) => p.date)).toEqual(["2026-10-05", "2026-10-06"]);
  });

  it("drops points outside the range", () => {
    const range = resolveDateRange("2026-10-06", "2026-10-06", NOW)!;
    const kept = filterPointsByRange(parsed, range);
    expect(kept.map((p) => p.date)).toEqual(["2026-10-06"]);
  });
});
