import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { clampText, DESCRIPTION_LIMIT, wrapText } from "./text.ts";

describe("clampText", () => {
  it("collapses a multi-line description into one paragraph", () => {
    expect(clampText("first line\nsecond\r\n\n  third  ", 400)).toBe(
      "first line second third",
    );
  });

  it("leaves text under the limit alone", () => {
    const text = "A short description.";
    expect(clampText(text, 400)).toBe(text);
  });

  it("cuts at the limit and marks the cut", () => {
    const long = "word ".repeat(200).trim();
    const clamped = clampText(long, 40);
    // 40, minus the space the cut landed on, plus " …"
    expect(clamped.endsWith("\u2026")).toBe(true);
    expect(clamped.length).toBeLessThanOrEqual(42);
    expect(clamped).not.toContain("  ");
  });

  it("keeps the default limit short enough to leave room for the tables", () => {
    expect(DESCRIPTION_LIMIT).toBeGreaterThan(120);
    expect(DESCRIPTION_LIMIT).toBeLessThanOrEqual(600);
  });
});

describe("wrapText", () => {
  it("wraps to the width without losing words", () => {
    const text = "the quick brown fox jumps over the lazy dog";
    const lines = wrapText(text, 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(10);
    expect(lines.join(" ").split(/\s+/)).toEqual(text.split(" "));
  });

  it("keeps a word wider than the width whole", () => {
    const lines = wrapText("supercalifragilistic", 5);
    expect(lines.join("")).toContain("supercalifragilistic");
  });

  it("never asks for a zero width", () => {
    expect(wrapText("hello", 0).every((line) => typeof line === "string")).toBe(true);
  });
});
