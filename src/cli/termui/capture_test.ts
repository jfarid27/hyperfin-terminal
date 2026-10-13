import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { captureOutput, toLines } from "./capture.ts";
import { table } from "../utils/table.ts";

describe("toLines", () => {
  it("strips ANSI colour and cursor sequences", () => {
    expect(toLines("\u001B[32mgreen text\u001B[39m\n")).toEqual(["green text"]);
    expect(toLines("\u001B[2J\u001B[Hafter clear")).toEqual(["after clear"]);
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
