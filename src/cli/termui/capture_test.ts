import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { captureOutput, toLines } from "./capture.ts";
import { renderTable, table } from "../utils/table.ts";
import { renderHyperlink } from "../utils/links.ts";

const MARKET_URL = "https://polymarket.com/event/nfl-sea-den-2026-10-16/nfl-sea-den-2026-10-16";

describe("toLines", () => {
  it("strips ANSI colour and cursor sequences", () => {
    expect(toLines("\u001B[32mgreen text\u001B[39m\n")).toEqual(["green text"]);
    expect(toLines("\u001B[2J\u001B[Hafter clear")).toEqual(["after clear"]);
  });

  it("gives back the visible text of an OSC 8 hyperlink", () => {
    // The shell's screen buffer strips OSC from whatever it is handed, so a
    // hyperlink reaches the log as its url. The generic escape pattern cannot
    // consume an OSC on its own — it eats the wrong characters and mangles the
    // url (losing the scheme), so the OSC has to be removed first.
    expect(toLines(`${renderHyperlink(MARKET_URL)}\n`)).toEqual([MARKET_URL]);
    expect(toLines(`Link: ${renderHyperlink(MARKET_URL)}\n`)).toEqual([
      `Link: ${MARKET_URL}`,
    ]);
  });

  it("keeps a hyperlinked table cell's alignment", () => {
    const rows = (link: string) => [["Slug", "Link"], ["nfl-sea-den-2026-10-16", link]];
    const options = { hasBorder: true, width: 60, fit: true };

    expect(toLines(renderTable(rows(renderHyperlink(MARKET_URL)), options, 60).join("\n")))
      .toEqual(toLines(renderTable(rows(MARKET_URL), options, 60).join("\n")));
  });

  it("splits on newlines, trims trailing space and drops blank lines", () => {
    expect(toLines("a  \n\n  \nb\n")).toEqual(["a", "b"]);
  });

  it("normalises carriage returns", () => {
    expect(toLines("first\r\nsecond\rthird")).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});

describe("captureOutput", () => {
  it("hands a hyperlinked table to the log as text, url intact", async () => {
    const captured = await captureOutput(async () => {
      table(
        [["Slug", "Link"], ["nfl-sea-den-2026-10-16", renderHyperlink(MARKET_URL)]],
        { hasBorder: true, width: 100, fit: true },
      );
      return 1;
    });

    const joined = captured.lines.join("\n");
    // Nothing downstream re-parses control bytes: the shell's log gets text.
    expect(joined.includes("\u001B")).toBe(false);
    // Every character of the url survives, however the cell wrapped it.
    expect(joined.replace(/[\s\u2502]/g, "")).toContain(
      MARKET_URL.replace(/\s/g, ""),
    );
  });

  it("collects console output written during the run", async () => {
    const captured = await captureOutput(async () => {
      console.log("hello from console");
      return 1;
    });

    expect(captured.ok).toBe(true);
    expect(captured.lines).toEqual(["hello from console"]);
  });

  it("reads the buffer after the run, not before it", async () => {
    // Reading the lines in the same object literal as the awaited call would
    // read the buffer before the command has produced anything.
    const captured = await captureOutput(async () => {
      console.log("written during the run");
      return "done";
    });

    expect(captured.lines).toEqual(["written during the run"]);
    expect(captured.ok && captured.value).toBe("done");
  });

  it("captures a table, which prints through the console", async () => {
    const captured = await captureOutput(async () => {
      table(
        [["Name", "Command"], ["crypto", "crypto"]],
        { hasBorder: true, width: 40, fit: true, firstRowTextAttr: { bgColor: "cyan" } },
      );
      return 1;
    });

    const joined = captured.lines.join("\n");
    expect(joined).toContain("crypto");
    expect(joined).toContain("\u256D");
  });

  it("keeps the output a failing command printed first", async () => {
    const captured = await captureOutput(async () => {
      console.log("usage: chart [symbol]");
      throw new Error("too many arguments");
    });

    expect(captured.ok).toBe(false);
    expect(captured.lines).toEqual(["usage: chart [symbol]"]);
    expect(!captured.ok && (captured.failure as Error).message).toBe(
      "too many arguments",
    );
  });

  it("intercepts the console only, never the process stream", async () => {
    // The frame renderer writes through the stream. Capturing it too would
    // freeze the screen for the length of a command, so the stream must be
    // left exactly as it was.
    const streamBefore = process.stdout.write;
    let streamDuring: unknown;
    const logBefore = console.log;

    const captured = await captureOutput(async () => {
      streamDuring = process.stdout.write;
      console.log("swallowed");
      return 0;
    });

    expect(streamDuring).toBe(streamBefore);
    expect(process.stdout.write).toBe(streamBefore);
    expect(console.log).toBe(logBefore);
    expect(captured.lines).toEqual(["swallowed"]);
  });

  it("restores them after a failure too", async () => {
    const before = console.log;
    await captureOutput(async () => {
      throw new Error("boom");
    });
    expect(console.log).toBe(before);
  });
});
