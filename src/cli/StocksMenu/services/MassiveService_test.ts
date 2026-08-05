import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Schema, Either } from "effect";
import {
  PreviousDayBarRaw,
  toSpotQuoteFromBars,
} from "./MassiveService.ts";

const validPrevRaw = {
  ticker: "NVDA",
  queryCount: 1,
  resultsCount: 1,
  adjusted: true,
  results: [
    {
      T: "NVDA",
      v: 139961152,
      vw: 199.0602,
      o: 198.4405,
      c: 200.75,
      h: 202,
      l: 194.95,
      t: 1785528000000,
      n: 2505950,
    },
  ],
  status: "OK",
  request_id: "7774fe573dc13c856ee0a5cf115789a9",
  count: 1,
};

const validRangeRaw = {
  ticker: "NVDA",
  queryCount: 2,
  resultsCount: 2,
  adjusted: true,
  results: [
    {
      v: 139961152,
      vw: 199.0602,
      o: 198.4405,
      c: 200.75,
      h: 202,
      l: 194.95,
      t: 1785470400000,
      n: 2505950,
    },
    {
      v: 129010151,
      vw: 194.3705,
      o: 193.45,
      c: 195.04,
      h: 197.25,
      l: 191.52,
      t: 1785384000000,
      n: 2475398,
    },
  ],
  status: "DELAYED",
  request_id: "5b9ac7c32c15e73983109d5ae7d0d534",
  count: 2,
};

describe("PreviousDayBarRaw schema", () => {
  it("validates a real Massive /prev response", () => {
    const result = Schema.decodeUnknownEither(PreviousDayBarRaw)(validPrevRaw);
    expect(Either.isRight(result)).toBe(true);
  });

  it("validates a real Massive range response", () => {
    const result = Schema.decodeUnknownEither(PreviousDayBarRaw)(validRangeRaw);
    expect(Either.isRight(result)).toBe(true);
  });
});

describe("toSpotQuoteFromBars", () => {
  it("maps two daily bars to a spot quote with change vs prior close", () => {
    const decoded = Schema.decodeUnknownSync(PreviousDayBarRaw)(validRangeRaw);
    const quote = toSpotQuoteFromBars("NVDA", decoded.results);

    expect(quote.symbol).toBe("NVDA");
    expect(quote.price).toBe(200.75);
    expect(quote.previousClose).toBe(195.04);
    expect(quote.change).toBeCloseTo(5.71, 2);
    expect(quote.changePercent).toBe("2.9276%");
    expect(quote.volume).toBe(139961152);
  });

  it("falls back to open when only one bar is available", () => {
    const decoded = Schema.decodeUnknownSync(PreviousDayBarRaw)(validPrevRaw);
    const quote = toSpotQuoteFromBars("NVDA", decoded.results);

    expect(quote.previousClose).toBe(198.4405);
    expect(quote.change).toBeCloseTo(2.3095, 4);
  });
});
