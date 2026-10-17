import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { hyperlink, isTerminal, renderHyperlink, stripOsc } from "./links.ts";

const URL = "https://polymarket.com/event/nfl-sea-den-2026-10-16/nfl-sea-den-2026-10-16";

describe("renderHyperlink", () => {
  it("wraps the text in an OSC 8 sequence pointing at the url", () => {
    expect(renderHyperlink(URL)).toBe(`\u001B]8;;${URL}\u001B\\${URL}\u001B]8;;\u001B\\`);
  });

  it("can label a link independently of its target", () => {
    expect(stripOsc(renderHyperlink(URL, "the market"))).toBe("the market");
  });
});

describe("stripOsc", () => {
  it("removes a hyperlink, leaving its visible text", () => {
    expect(stripOsc(renderHyperlink(URL))).toBe(URL);
  });

  it("removes an ST-terminated sequence as well as a BEL-terminated one", () => {
    expect(stripOsc("\u001B]0;window title\u0007body")).toBe("body");
    expect(stripOsc("\u001B]8;;https://example.com\u001B\\link\u001B]8;;\u001B\\")).toBe("link");
  });

  it("leaves ANSI colour to the caller's own stripAnsi", () => {
    // Measuring code strips colour and links separately; removing SGR here
    // would silently change what `renderTable` draws.
    expect(stripOsc("\u001B[32mgreen\u001B[39m")).toBe("\u001B[32mgreen\u001B[39m");
  });

  it("passes plain text through untouched", () => {
    expect(stripOsc(URL)).toBe(URL);
  });
});

describe("hyperlink", () => {
  it("never hides the url — stripping the escape gives it back", () => {
    expect(stripOsc(hyperlink(URL))).toBe(URL);
  });

  it("emits the escape on a terminal and plain text everywhere else", () => {
    // A redirected run (the e2e harness, a script probe, `cli < in > out`) must
    // carry no control bytes, so the escape is gated on stdout being a tty.
    const rendered = hyperlink(URL);
    expect(rendered).toBe(isTerminal() ? renderHyperlink(URL) : URL);
  });
});
