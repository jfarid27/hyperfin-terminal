import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { computeLayout } from "npm:@termuijs/core";
import type { KeyEvent } from "npm:@termuijs/core";
import { applyPromptWidth, buildShellLayout, INPUT_BAR_HEIGHT } from "./layout.ts";
import { caretPathSegments, caretPathWidth } from "./path.ts";
import type { Menu } from "../types.ts";

const menu = (name: string): Menu => ({
  name,
  description: name,
  messagePrompt: ">",
  options: () => [],
});

const WIDTH = 100;
const HEIGHT = 30;

/**
 * Build the shell's real widget tree and run a layout pass for it.
 *
 * Layout is pure arithmetic over the tree, so the full-width guarantee can be
 * checked without a terminal.
 */
const shellAt = (stack: Menu[], onTab: () => void = () => {}) => {
  const segments = caretPathSegments(stack);
  const widgets = buildShellLayout({
    pathSegments: segments,
    promptWidth: caretPathWidth(segments),
    onSubmit: () => {},
    onTab,
  });
  const layout = (width = WIDTH, height = HEIGHT) => {
    computeLayout(widgets.root.getLayoutNode(), width, height);
    widgets.root.syncLayout();
  };
  layout();
  return { ...widgets, layout };
};

describe("buildShellLayout", () => {
  it("gives the input box every column the prompt does not take", () => {
    const { bar, input } = shellAt([menu("Main Menu")]);
    expect(bar.rect.width).toBe(WIDTH);
    expect(input.rect.x + input.rect.width).toBe(WIDTH);
  });

  it("keeps the input full width with a deeper path", () => {
    const { input } = shellAt([
      menu("Main Menu"),
      menu("Stocks Menu"),
      menu("Technicals"),
    ]);
    expect(input.rect.x + input.rect.width).toBe(WIDTH);
  });

  it("reflows the input to the new terminal width", () => {
    const { input, layout } = shellAt([menu("Main Menu")]);
    layout(140, HEIGHT);
    expect(input.rect.x + input.rect.width).toBe(140);
    layout(80, HEIGHT);
    expect(input.rect.x + input.rect.width).toBe(80);
  });

  it("stacks header, log, hint and bar without overlap", () => {
    const { header, log, hint, bar, input } = shellAt([menu("Main Menu")]);
    expect(header.rect.height).toBe(1);
    expect(hint.rect.height).toBe(1);
    expect(input.rect.y + INPUT_BAR_HEIGHT).toBe(HEIGHT);
    expect(bar.rect.y + bar.rect.height).toBe(HEIGHT);
    // the log takes every row the fixed rows do not
    expect(log.rect.height).toBe(HEIGHT - 1 - 1 - INPUT_BAR_HEIGHT);
    const rows = [header, log, hint, bar];
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].rect.y).toBeGreaterThanOrEqual(
        rows[i - 1].rect.y + rows[i - 1].rect.height,
      );
    }
  });

  it("keeps the hint row inside the terminal width", () => {
    const { hint } = shellAt([menu("Main Menu")]);
    expect(hint.rect.width).toBe(WIDTH);
  });
});

describe("applyPromptWidth", () => {
  it("widens the prompt and keeps the input flush with the edge", () => {
    const { bar, input, layout } = shellAt([menu("Main Menu")]);
    const widened = caretPathWidth(
      caretPathSegments([menu("Main Menu"), menu("Stocks Menu")]),
    );

    expect(applyPromptWidth(bar, widened)).toBe(true);

    layout();
    expect(input.rect.x).toBe(widened);
    expect(input.rect.x + input.rect.width).toBe(WIDTH);
  });

  it("reports no change when the width is already the current one", () => {
    const { bar } = shellAt([menu("Main Menu")]);
    const current = caretPathWidth(caretPathSegments([menu("Main Menu")]));
    expect(applyPromptWidth(bar, current)).toBe(false);
  });
});

describe("shell input keys", () => {
  const keyEvent = (key: string): KeyEvent =>
    ({
      key,
      ctrl: false,
      alt: false,
      shift: false,
      preventDefault() {},
      stopPropagation() {},
    }) as unknown as KeyEvent;

  it('types a space, which the frame reports as the "space" key', () => {
    const { input } = shellAt([menu("Main Menu")]);
    input.events.emit("key", keyEvent("space"));
    expect(input.value).toBe(" ");
  });

  it("types a parameterised command, spaces included", () => {
    const { input } = shellAt([menu("Main Menu")]);
    for (const key of ["s", "p", "o", "t", "space", "A", "A", "P", "L"]) {
      input.events.emit("key", keyEvent(key));
    }
    expect(input.value).toBe("spot AAPL");
  });

  it("hands tab to the completion handler the shell provides", () => {
    const tabs: string[] = [];
    const { input } = shellAt([menu("Main Menu")], () => tabs.push("tab"));

    // The widget claims tab for itself and calls `acceptSuggestion`, so a real
    // tab press is the only honest way to check the hand-off.
    input.events.emit("key", keyEvent("tab"));

    expect(tabs).toEqual(["tab"]);
  });

  it("hands tab over with the text as typed, so arguments stay the user's business", () => {
    const seen: string[] = [];
    const { input } = shellAt([menu("Main Menu")], () => seen.push(input.value));

    input.events.emit("key", keyEvent("p"));
    input.events.emit("key", keyEvent("tab"));
    input.events.emit("key", keyEvent("space"));
    input.events.emit("key", keyEvent("tab"));

    // The shell sees what was typed and decides what can be completed; a line
    // with arguments is its call to leave alone (covered in complete_test).
    expect(seen).toEqual(["p", "p "]);
  });
});
