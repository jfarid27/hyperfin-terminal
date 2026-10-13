/**
 * Display formatting. Pure functions, so the table output of the DEX and
 * sentiment menus can be trusted without a terminal.
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { formatCompactUsd, formatSignedPct, formatUsd, toUtcLabel } from "./format.ts";

describe("formatUsd", () => {
  it("keeps cents for ordinary prices and grouping for large ones", () => {
    expect(formatUsd(2514.365)).toBe("$2,514.37");
    expect(formatUsd(1234567.891)).toBe("$1,234,567.89");
    expect(formatUsd(6.6)).toBe("$6.60");
    expect(formatUsd(0)).toBe("$0");
  });

  it("keeps significant digits for sub-cent tokens", () => {
    // Two decimals would render every one of these as "$0.00".
    expect(formatUsd(0.0022034969)).toBe("$0.0022035");
    expect(formatUsd(0.00080252)).toBe("$0.00080252");
    expect(formatUsd(4.22e-6)).toBe("$0.00000422");
  });

  it("says n/a rather than printing NaN", () => {
    expect(formatUsd(Number.NaN)).toBe("n/a");
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe("n/a");
  });
});

describe("formatCompactUsd", () => {
  it("abbreviates with the largest fitting unit", () => {
    expect(formatCompactUsd(103836.77)).toBe("$103.84K");
    expect(formatCompactUsd(586841.76)).toBe("$586.84K");
    expect(formatCompactUsd(1123301826557.15)).toBe("$1.12T");
    expect(formatCompactUsd(2107721.35)).toBe("$2.11M");
    expect(formatCompactUsd(324836.7)).toBe("$324.84K");
  });

  it("keeps small amounts in full and reports absence as n/a", () => {
    expect(formatCompactUsd(999.5)).toBe("$999.50");
    expect(formatCompactUsd(undefined)).toBe("n/a");
    expect(formatCompactUsd(Number.NaN)).toBe("n/a");
  });
});

describe("formatSignedPct", () => {
  it("carries the sign", () => {
    expect(formatSignedPct(14.72)).toBe("+14.72%");
    expect(formatSignedPct(-3.1)).toBe("-3.10%");
    expect(formatSignedPct(0)).toBe("+0.00%");
  });

  it("reports an unknown change as n/a", () => {
    expect(formatSignedPct(undefined)).toBe("n/a");
  });
});

describe("toUtcLabel", () => {
  it("renders an ISO instant to the minute, in UTC", () => {
    expect(toUtcLabel("2026-10-13T17:23:10.029Z")).toBe("2026-10-13 17:23 UTC");
  });

  it("passes through something unparseable instead of printing Invalid Date", () => {
    expect(toUtcLabel("sometime tuesday")).toBe("sometime tuesday");
    expect(toUtcLabel(undefined)).toBe("n/a");
  });
});
