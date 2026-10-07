import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { boldCell, greenCell, redCell, escapeTableMarkup } from "./table_markup.ts";

describe("table_markup", () => {
  it("wraps a cell in terminal-kit bold markup", () => {
    expect(boldCell("TSMC34.SAO")).toBe("^+TSMC34.SAO^:");
  });

  it("wraps a cell in terminal-kit colour markup", () => {
    expect(greenCell("ITM")).toBe("^gITM^:");
    expect(redCell("OTM")).toBe("^rOTM^:");
  });

  it("emits no ANSI escape sequences", () => {
    // chalk (ANSI) in a table cell renders as literal "[1m" text — the bug.
    for (const cell of [boldCell("ABC"), greenCell("ITM"), redCell("OTM")]) {
      expect(cell.includes("\u001b"),
        "Cells must not carry ANSI escapes"
      ).toBe(false);
      expect(/\[\d+m/.test(cell),
        "Cells must not carry literal ANSI codes"
      ).toBe(false);
    }
  });

  it("escapes the ^ markup metacharacter in dynamic text", () => {
    expect(escapeTableMarkup("A^B")).toBe("A^^B");
    expect(boldCell("A^B.SAO")).toBe("^+A^^B.SAO^:");
  });

  it("leaves plain text untouched", () => {
    expect(escapeTableMarkup("Taiwan Semiconductor")).toBe("Taiwan Semiconductor");
  });
});
