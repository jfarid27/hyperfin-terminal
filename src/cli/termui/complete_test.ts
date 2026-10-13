import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { commandWords, completeFirstWord, cycleCompletion } from "./complete.ts";

const MAIN = ["crypto", "stocks", "government", "options", "forex", "bonds", "news", "predictions", "script", "keys", "exit", "showconfig"];

describe("completeFirstWord", () => {
  it("completes an unambiguous prefix", () => {
    expect(completeFirstWord("st", MAIN)).toEqual({
      value: "stocks",
      candidates: ["stocks"],
      ambiguous: false,
    });
  });

  it("ignores case and hands back the command's own casing", () => {
    expect(completeFirstWord("St", MAIN)?.value).toBe("stocks");
  });

  it("fills the longest common prefix when the match is ambiguous", () => {
    const commands = ["chart", "change"];
    expect(completeFirstWord("ch", commands)).toEqual({
      value: "cha",
      candidates: ["chart", "change"],
      ambiguous: true,
    });
  });

  it("falls back to the first candidate when the prefix cannot grow", () => {
    const commands = ["script", "stocks", "showconfig"];
    expect(completeFirstWord("s", commands)).toEqual({
      value: "script",
      candidates: commands,
      ambiguous: true,
    });
  });

  it("leaves a line alone once it has arguments", () => {
    expect(completeFirstWord("spot AAPL", MAIN)).toBeUndefined();
    expect(completeFirstWord("spot ", MAIN)).toBeUndefined();
  });

  it("does nothing for an empty line or an unknown prefix", () => {
    expect(completeFirstWord("", MAIN)).toBeUndefined();
    expect(completeFirstWord("zzz", MAIN)).toBeUndefined();
  });

  it("completes a word that is already whole without changing it", () => {
    expect(completeFirstWord("bonds", MAIN)).toEqual({
      value: "bonds",
      candidates: ["bonds"],
      ambiguous: false,
    });
  });
});

describe("cycleCompletion", () => {
  const commands = ["script", "stocks", "showconfig"];

  it("advances to the next candidate and wraps around", () => {
    expect(cycleCompletion(commands, "script")).toBe("stocks");
    expect(cycleCompletion(commands, "stocks")).toBe("showconfig");
    expect(cycleCompletion(commands, "showconfig")).toBe("script");
  });

  it("does not cycle when there is only one candidate", () => {
    expect(cycleCompletion(["stocks"], "stocks")).toBeUndefined();
  });

  it("does not cycle from a word that is not standing on a candidate", () => {
    expect(cycleCompletion(commands, "s")).toBeUndefined();
    expect(cycleCompletion(commands, "cha")).toBeUndefined();
  });

  it("matches the word case-insensitively", () => {
    expect(cycleCompletion(commands, "Stocks")).toBe("showconfig");
  });
});

describe("commandWords", () => {
  it("keeps the first word of each command, deduplicated, in order", () => {
    expect(commandWords(["price bitcoin", "price", "chart", "set symbol"])).toEqual([
      "price",
      "chart",
      "set",
    ]);
  });
});
