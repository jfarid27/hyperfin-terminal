import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { stringWidth } from "npm:@termuijs/core";
import type { Menu } from "../types.ts";
import {
  APP_ROOT_SEGMENT,
  caretPathSegments,
  caretPathWidth,
  menuPathSegment,
  menuPathSegments,
  PATH_SEPARATOR,
} from "./path.ts";

const menu = (name: string): Menu => ({
  name,
  description: name,
  messagePrompt: ">",
  options: () => [],
});

describe("menuPathSegment", () => {
  it("drops a trailing \"menu\" and lowercases", () => {
    expect(menuPathSegment(menu("Crypto Menu"))).toBe("crypto");
    expect(menuPathSegment(menu("Main Menu"))).toBe("main");
    expect(menuPathSegment(menu("Stocks Menu"))).toBe("stocks");
  });

  it("keeps a name that carries no menu suffix", () => {
    expect(menuPathSegment(menu("Technicals"))).toBe("technicals");
  });
});

describe("menuPathSegments", () => {
  it("leads with the app name and follows the navigation stack", () => {
    expect(menuPathSegments([menu("Main Menu")])).toEqual([
      APP_ROOT_SEGMENT,
      "main",
    ]);
    expect(menuPathSegments([menu("Main Menu"), menu("Stocks Menu")])).toEqual([
      "hyperfin",
      "main",
      "stocks",
    ]);
  });
});

describe("caretPathSegments", () => {
  it("ends in an empty segment so the path closes with a separator", () => {
    const segments = caretPathSegments([menu("Crypto Menu")]);
    expect(segments).toEqual(["hyperfin", "crypto", ""]);
    expect(segments.join(` ${PATH_SEPARATOR} `)).toBe("hyperfin > crypto > ");
  });
});

describe("caretPathWidth", () => {
  it("measures the rendered path plus the gap before the input box", () => {
    // "hyperfin > crypto > " is 20 columns; the extra column is the gap.
    expect(caretPathWidth(caretPathSegments([menu("Crypto Menu")]))).toBe(21);
  });

  it("grows with the stack", () => {
    const shallow = caretPathWidth(caretPathSegments([menu("Main Menu")]));
    const deep = caretPathWidth(
      caretPathSegments([menu("Main Menu"), menu("Stocks Menu")]),
    );
    expect(deep).toBeGreaterThan(shallow);
  });
});

describe("PATH_SEPARATOR", () => {
  it("is measured as one column, so it cannot shift the row it sits in", () => {
    // The renderer writes a changed span cell-by-cell and skips continuation
    // cells, so a glyph it counts as two columns but the terminal paints as one
    // drags everything after it a column to the left. Decorative arrows like
    // "❯" do exactly that; the separator must not.
    expect(stringWidth(PATH_SEPARATOR)).toBe(1);
    expect(PATH_SEPARATOR).toBe(">");
  });
});
