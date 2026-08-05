import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Schema, Either } from "effect";
import {
  GlobalQuoteRaw,
  TimeSeriesDailyRaw,
  toSpotQuote,
  toChartPoints,
} from "../../../services/AlphaVantageService/index.ts";

// ── Real API response fixtures (from curl against NVDA, 2026-08-02) ──

const validSpotRaw = {
  "Global Quote": {
    "01. symbol": "NVDA",
    "02. open": "198.4405",
    "03. high": "202.0000",
    "04. low": "194.9500",
    "05. price": "200.7500",
    "06. volume": "139961152",
    "07. latest trading day": "2026-07-31",
    "08. previous close": "195.0400",
    "09. change": "5.7100",
    "10. change percent": "2.9276%",
  },
};

const validChartRaw = {
  "Meta Data": {
    "1. Information": "Daily Prices (open, high, low, close) and Volumes",
    "2. Symbol": "NVDA",
    "3. Last Refreshed": "2026-07-31",
    "4. Output Size": "Compact",
    "5. Time Zone": "US/Eastern",
  },
  "Time Series (Daily)": {
    "2026-07-31": {
      "1. open": "198.4405",
      "2. high": "202.0000",
      "3. low": "194.9500",
      "4. close": "200.7500",
      "5. volume": "139961152",
    },
    "2026-07-30": {
      "1. open": "193.4500",
      "2. high": "197.2500",
      "3. low": "191.5200",
      "4. close": "195.0400",
      "5. volume": "129010151",
    },
    "2026-07-29": {
      "1. open": "195.8450",
      "2. high": "197.0740",
      "3. low": "190.0100",
      "4. close": "190.0100",
      "5. volume": "147680809",
    },
  },
};

// ── Schema validation tests ──

describe("GlobalQuoteRaw schema", () => {
  it("validates a real AlphaVantage GLOBAL_QUOTE response", () => {
    const result = Schema.decodeUnknownEither(GlobalQuoteRaw)(validSpotRaw);
    expect(Either.isRight(result), "valid spot response should decode").toBe(true);
  });

  it("rejects a response missing the Global Quote key", () => {
    const result = Schema.decodeUnknownEither(GlobalQuoteRaw)({});
    expect(Either.isLeft(result), "empty object should fail").toBe(true);
  });

  it("rejects a response with wrong field types", () => {
    const bad = {
      "Global Quote": {
        "01. symbol": "NVDA",
        "02. open": "198.4405",
        "03. high": "202.0000",
        "04. low": "194.9500",
        "05. price": 200.75, // number, not string
        "06. volume": "139961152",
        "07. latest trading day": "2026-07-31",
        "08. previous close": "195.0400",
        "09. change": "5.7100",
        "10. change percent": "2.9276%",
      },
    };
    const result = Schema.decodeUnknownEither(GlobalQuoteRaw)(bad);
    expect(Either.isLeft(result), "wrong type should fail").toBe(true);
  });

  it("rejects a response missing a required field", () => {
    const bad = {
      "Global Quote": {
        "01. symbol": "NVDA",
        "02. open": "198.4405",
        "03. high": "202.0000",
        "04. low": "194.9500",
        "05. price": "200.7500",
        "06. volume": "139961152",
        "07. latest trading day": "2026-07-31",
        "08. previous close": "195.0400",
        "09. change": "5.7100",
        // missing "10. change percent"
      },
    };
    const result = Schema.decodeUnknownEither(GlobalQuoteRaw)(bad);
    expect(Either.isLeft(result), "missing field should fail").toBe(true);
  });
});

describe("TimeSeriesDailyRaw schema", () => {
  it("validates a real AlphaVantage TIME_SERIES_DAILY response", () => {
    const result = Schema.decodeUnknownEither(TimeSeriesDailyRaw)(validChartRaw);
    expect(Either.isRight(result), "valid chart response should decode").toBe(true);
  });

  it("rejects a response missing Time Series (Daily)", () => {
    const result = Schema.decodeUnknownEither(TimeSeriesDailyRaw)({ "Meta Data": {} });
    expect(Either.isLeft(result), "missing series should fail").toBe(true);
  });

  it("rejects a response with malformed daily entry", () => {
    const bad = {
      "Meta Data": {
        "2. Symbol": "NVDA",
        "3. Last Refreshed": "2026-07-31",
      },
      "Time Series (Daily)": {
        "2026-07-31": {
          "1. open": "198.4405",
          "2. high": "202.0000",
          "3. low": "194.9500",
          "4. close": 200.75, // number, not string
          "5. volume": "139961152",
        },
      },
    };
    const result = Schema.decodeUnknownEither(TimeSeriesDailyRaw)(bad);
    expect(Either.isLeft(result), "wrong type in entry should fail").toBe(true);
  });
});

// ── Transformation tests ──

describe("toSpotQuote", () => {
  it("transforms a valid raw response into a clean SpotQuote", () => {
    const decoded = Schema.decodeUnknownSync(GlobalQuoteRaw)(validSpotRaw);
    const quote = toSpotQuote(decoded);

    expect(quote.symbol).toBe("NVDA");
    expect(quote.price).toBe(200.75);
    expect(quote.change).toBe(5.71);
    expect(quote.changePercent).toBe("2.9276%");
    expect(quote.open).toBe(198.4405);
    expect(quote.high).toBe(202.0);
    expect(quote.low).toBe(194.95);
    expect(quote.previousClose).toBe(195.04);
    expect(quote.volume).toBe(139961152);
    expect(quote.latestTradingDay).toBe("2026-07-31");
  });

  it("converts all numeric fields from strings to numbers", () => {
    const decoded = Schema.decodeUnknownSync(GlobalQuoteRaw)(validSpotRaw);
    const quote = toSpotQuote(decoded);

    expect(typeof quote.price).toBe("number");
    expect(typeof quote.change).toBe("number");
    expect(typeof quote.open).toBe("number");
    expect(typeof quote.high).toBe("number");
    expect(typeof quote.low).toBe("number");
    expect(typeof quote.previousClose).toBe("number");
    expect(typeof quote.volume).toBe("number");
  });
});

describe("toChartPoints", () => {
  it("transforms a valid raw response into sorted ChartPoints", () => {
    const decoded = Schema.decodeUnknownSync(TimeSeriesDailyRaw)(validChartRaw);
    const points = toChartPoints(decoded);

    expect(points.length).toBe(3);
    // Should be sorted ascending by date
    expect(points[0].date).toBe("2026-07-29");
    expect(points[1].date).toBe("2026-07-30");
    expect(points[2].date).toBe("2026-07-31");
  });

  it("converts all numeric fields from strings to numbers", () => {
    const decoded = Schema.decodeUnknownSync(TimeSeriesDailyRaw)(validChartRaw);
    const points = toChartPoints(decoded);

    for (const p of points) {
      expect(typeof p.open).toBe("number");
      expect(typeof p.high).toBe("number");
      expect(typeof p.low).toBe("number");
      expect(typeof p.close).toBe("number");
      expect(typeof p.volume).toBe("number");
      expect(typeof p.timestamp).toBe("number");
    }
  });

  it("sets timestamps to epoch milliseconds", () => {
    const decoded = Schema.decodeUnknownSync(TimeSeriesDailyRaw)(validChartRaw);
    const points = toChartPoints(decoded);

    expect(points[0].timestamp).toBe(new Date("2026-07-29").getTime());
    expect(points[2].timestamp).toBe(new Date("2026-07-31").getTime());
    // Timestamps should be strictly increasing
    expect(points[0].timestamp).toBeLessThan(points[1].timestamp);
    expect(points[1].timestamp).toBeLessThan(points[2].timestamp);
  });

  it("preserves correct close values", () => {
    const decoded = Schema.decodeUnknownSync(TimeSeriesDailyRaw)(validChartRaw);
    const points = toChartPoints(decoded);

    expect(points[0].close).toBe(190.01);
    expect(points[1].close).toBe(195.04);
    expect(points[2].close).toBe(200.75);
  });
});
