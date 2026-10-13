import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { alpacaErrorHint, ENTITLEMENT_HINT } from "./alpaca_errors.ts";

describe("alpacaErrorHint", () => {
  it("explains an entitlement failure, which is what a 403 from Alpaca means", () => {
    // The real message, verbatim: every forex pair answers this on a data plan
    // without the FX feed, while equities on the same key keep working.
    expect(alpacaErrorHint("Alpaca (403) forbidden: insufficient grants")).toBe(
      ENTITLEMENT_HINT,
    );
    expect(alpacaErrorHint("Alpaca (403) forbidden")).toBe(ENTITLEMENT_HINT);
  });

  it("stays quiet for errors that already speak for themselves", () => {
    for (
      const message of [
        "Alpaca (400) invalid symbol: NOTAPAIR",
        "Alpaca (429) too many requests",
        "Alpaca (401) unauthorized",
        "fetch failed: connection refused",
        "",
      ]
    ) {
      expect(alpacaErrorHint(message)).toBeUndefined();
    }
  });

  it("points at a way forward", () => {
    expect(ENTITLEMENT_HINT).toContain("source alphavantage");
  });
});
