import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import type { Menu, MenuOption } from "../types.ts";
import { CommandResultType, TerminalUserStateConfigContext } from "../types.ts";
import { menuHeading, menuRows } from "./menu_view.ts";

const option = (name: string, command: string, description: string): MenuOption => ({
  name,
  command,
  description,
  action: () =>
    Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      return { result: { type: CommandResultType.Success }, state: st };
    }),
});

const menu = (name: string): Menu => ({
  name,
  description: name,
  messagePrompt: ">",
  options: () => [],
});

describe("menuRows", () => {
  const rows = menuRows([
    option("spot", "spot [symbol]", "Fetch spot price"),
    option("prediction markets", "predictions", "Fetch prediction markets"),
  ]);

  it("pads the name column so every command starts at the same column", () => {
    expect(rows[0].indexOf("spot [symbol]")).toBe(
      rows[1].indexOf("predictions"),
    );
  });

  it("pads the command column so every description starts at the same column", () => {
    expect(rows[0].indexOf("Fetch spot price")).toBe(
      rows[1].indexOf("Fetch prediction markets"),
    );
  });

  it("renders one row per option and keeps each description intact", () => {
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("spot [symbol]");
    expect(rows[0]).toContain("Fetch spot price");
    expect(rows[1]).toContain("Fetch prediction markets");
  });

  it("separates the columns by exactly two spaces", () => {
    expect(menuRows([option("back", "back", "Go back")])[0]).toBe(
      "back  back  Go back",
    );
  });

  it("never leaves trailing padding", () => {
    for (const row of rows) expect(row).not.toMatch(/\s$/);
  });

  it("renders an empty menu as no rows", () => {
    expect(menuRows([])).toEqual([]);
  });
});

describe("menuHeading", () => {
  it("prints the menu name at the root", () => {
    expect(menuHeading(menu("Main Menu"), 1)).toBe("Main Menu");
  });

  it("indents deeper menus so a path can be traced in the scrollback", () => {
    expect(menuHeading(menu("Technicals"), 2)).toBe("  Technicals");
    expect(menuHeading(menu("Technicals"), 3)).toBe("    Technicals");
  });
});
