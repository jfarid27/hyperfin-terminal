import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import chalk from "chalk";
import { stringWidth, stripAnsi } from "npm:@termuijs/core";
import { boldCell, greenCell, redCell } from "./table_markup.ts";

/** Run `fn` with colour forced on or off, so assertions do not depend on the runner's TTY. */
const withColorLevel = (level: number, fn: () => void) => {
  const previous = chalk.level;
  chalk.level = level as typeof chalk.level;
  try {
    fn();
  } finally {
    chalk.level = previous;
  }
};

describe("table_markup", () => {
  it("leaves the cell text intact", () => {
    for (
      const cell of [boldCell("TSMC34.SAO"), greenCell("ITM"), redCell("OTM")]
    ) {
      expect(cell).toContain(stripAnsi(cell));
      expect(stripAnsi(cell).length).toBeGreaterThan(0);
    }
    expect(stripAnsi(greenCell("ITM"))).toBe("ITM");
    expect(stripAnsi(redCell("OTM"))).toBe("OTM");
    expect(stripAnsi(boldCell("TSMC34.SAO"))).toBe("TSMC34.SAO");
  });

  it("carries no terminal-kit markup and no literal ANSI codes", () => {
    for (
      const cell of [boldCell("ABC"), greenCell("ITM"), redCell("OTM")]
    ) {
      expect(cell.includes("^")).toBe(false);
      expect(/\[\d+m/.test(cell) && !cell.includes("\u001b")).toBe(false);
    }
  });

  it("adds no visible width, so a styled cell pads the same as a plain one", () => {
    expect(stringWidth(greenCell("ITM"))).toBe(stringWidth("ITM"));
    expect(stringWidth(boldCell("TSMC34.SAO"))).toBe(stringWidth("TSMC34.SAO"));
  });

  it("styles the cell with ANSI when colour is available", () => {
    withColorLevel(1, () => {
      expect(boldCell("ABC")).toContain("\u001b[");
      expect(greenCell("ITM")).toContain("\u001b[");
    });
  });

  it("falls back to plain text when colour is unavailable", () => {
    withColorLevel(0, () => {
      expect(boldCell("ABC")).toBe("ABC");
      expect(greenCell("ITM")).toBe("ITM");
      expect(redCell("OTM")).toBe("OTM");
    });
  });
});
