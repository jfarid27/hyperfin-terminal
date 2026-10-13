import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { stringWidth, stripAnsi } from "npm:@termuijs/core";
import { renderTable } from "./table.ts";
import { greenCell } from "./table_markup.ts";

/** The option set every caller in this repo uses. */
const CALLER_OPTIONS = {
  hasBorder: true,
  contentHasMarkup: true,
  borderChars: "lightRounded",
  borderAttr: { color: "cyan" },
  textAttr: { bgColor: "default" },
  firstRowTextAttr: { bgColor: "cyan" },
  width: 120,
  fit: true,
} as const;

const rows = [
  ["Name", "Command", "Description"],
  ["crypto", "crypto", "Fetch crypto prices"],
  ["prediction markets", "predictions", "Fetch prediction markets"],
];

describe("renderTable", () => {
  it("frames the table and separates the header row", () => {
    const lines = renderTable(rows, CALLER_OPTIONS);
    expect(lines[0].startsWith("\u256D")).toBe(true);
    expect(lines[0].endsWith("\u256E")).toBe(true);
    expect(lines[2].startsWith("\u251C")).toBe(true);
    expect(lines[lines.length - 1].startsWith("\u2570")).toBe(true);
    expect(lines[lines.length - 1].endsWith("\u256F")).toBe(true);
  });

  it("stretches to the requested width when fit is set", () => {
    const lines = renderTable(rows, CALLER_OPTIONS);
    for (const line of lines) {
      expect(stringWidth(line)).toBe(120);
    }
  });

  it("keeps every column aligned across rows", () => {
    const lines = renderTable(rows, CALLER_OPTIONS, 120);
    const body = lines.slice(3, -1);
    const bars = body.map((line) => line.indexOf("\u2502", 1));
    expect(new Set(bars).size).toBe(1);
  });

  it("keeps each cell's text readable", () => {
    const rendered = stripAnsi(renderTable(rows, CALLER_OPTIONS).join("\n"));
    expect(rendered).toContain("prediction markets");
    expect(rendered).toContain("Fetch prediction markets");
    expect(rendered).toContain("Command");
  });

  it("takes the lost width off the widest column, not the narrow ones", () => {
    const narrow = renderTable(rows, CALLER_OPTIONS, 60).map(stripAnsi);
    for (const line of narrow) {
      expect(stringWidth(line)).toBeLessThanOrEqual(60);
    }
    // Name and command keep their text; the long description column is the one
    // that has to wrap.
    const joined = narrow.join("\n");
    expect(joined).toContain("prediction markets");
    expect(joined).toContain("predictions");
  });

  it("keeps the frame square when the surface is very narrow", () => {
    const lines = renderTable(rows, CALLER_OPTIONS, 24).map(stripAnsi);
    for (const line of lines) {
      expect(stringWidth(line)).toBeLessThanOrEqual(24);
    }
    expect(lines[0]).toContain("\u256E");
    expect(lines[lines.length - 1]).toContain("\u256F");
  });

  it("measures a styled cell by its visible text", () => {
    const plain = renderTable(
      [["Status"], ["ITM"]],
      { ...CALLER_OPTIONS, width: 40 },
    );
    const styled = renderTable(
      [["Status"], [greenCell("ITM")]],
      { ...CALLER_OPTIONS, width: 40 },
    );
    expect(styled.map(stringWidth)).toEqual(plain.map(stringWidth));
    expect(stripAnsi(styled[3])).toContain("ITM");
  });

  it("renders without a border when hasBorder is not set", () => {
    const lines = renderTable(rows, { width: 80, fit: true });
    expect(lines.join("\n")).not.toContain("\u2502");
    expect(lines[0]).toContain("Name");
  });

  it("returns nothing for an empty table", () => {
    expect(renderTable([], CALLER_OPTIONS)).toEqual([]);
  });

  it("pads ragged rows to the widest row", () => {
    const lines = renderTable(
      [["a", "b", "c"], ["d"]],
      CALLER_OPTIONS,
    );
    // top border, header row, header rule, one data row, bottom border
    expect(lines).toHaveLength(5);
    for (const line of lines) expect(stringWidth(line)).toBe(120);
  });

  it("wraps a cell rather than dropping its text", () => {
    const long = "Example package: a tiny menu that reads a symbol from state [package:example-package/index.ts]";
    const rendered = stripAnsi(
      renderTable([["hello-quotes", "hello", long]], CALLER_OPTIONS, 100).join("\n"),
    );

    // Every character survives, wrapped over more lines.
    expect(rendered.replace(/[\s│]/g, "")).toContain(
      "example-package/index.ts".replace(/[\s]/g, ""),
    );
    for (const line of rendered.split("\n")) {
      expect(stringWidth(line)).toBe(100);
    }
  });

  it("splits a word longer than its column instead of overflowing the box", () => {
    const lines = renderTable(
      [["symbol"], ["SUPERCALIFRAGILISTICEXPIALIDOCIOUS-TICKER"]],
      CALLER_OPTIONS,
      30,
    ).map(stripAnsi);
    for (const line of lines) expect(stringWidth(line)).toBe(30);
  });
});

describe("renderTable cells", () => {
  it("renders cells that are not strings", () => {
    // The polymarket `market` command passes a boolean and two numbers, which
    // used to blow up in the width table (`str.replace is not a function`).
    const lines = renderTable(
      [
        ["Active", "Liquidity", "Volume"],
        [true, 112539.6954, 443844.6077500001],
      ],
      CALLER_OPTIONS,
    );
    const text = lines.join("\n");
    expect(text).toContain("true");
    expect(text).toContain("112539.6954");
    expect(text).toContain("443844.6077500001");
    // the box is still square
    for (const line of lines) expect(stringWidth(stripAnsi(line))).toBe(120);
  });

  it("reads a missing cell as empty and leaves the box in shape", () => {
    const lines = renderTable(
      [["a", "b", "c"], ["only one"]],
      CALLER_OPTIONS,
    );
    expect(lines.join("\n")).toContain("only one");
    for (const line of lines) expect(stringWidth(stripAnsi(line))).toBe(120);
  });

  it("treats null and undefined cells as empty", () => {
    const lines = renderTable(
      [["a", "b"], [null, undefined]],
      CALLER_OPTIONS,
    );
    for (const line of lines) expect(stringWidth(stripAnsi(line))).toBe(120);
  });
});
