import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { logScrollFromMouse, logScrollIntent } from "./scroll.ts";

describe("logScrollIntent", () => {
  it("moves one line per arrow, and scrolling back stops following", () => {
    expect(logScrollIntent("up", false, 20)).toEqual({ lines: -1, follow: false });
    // Scrolling forward must not drop out of follow mode on its own.
    expect(logScrollIntent("down", false, 20)).toEqual({ lines: 1 });
  });

  it("moves a screenful per page key", () => {
    expect(logScrollIntent("pageup", false, 20)).toEqual({ lines: -20, follow: false });
    expect(logScrollIntent("pagedown", false, 20)).toEqual({ lines: 20 });
  });

  it("never pages by zero on a log with no room", () => {
    expect(logScrollIntent("pageup", false, 0)).toEqual({ lines: -1, follow: false });
  });

  it("jumps to the tail and follows on Ctrl-G", () => {
    const intent = logScrollIntent("g", true, 20);
    expect(intent?.follow).toBe(true);
    expect(intent?.lines).toBeGreaterThan(1000);
  });

  it("ignores keys it does not own", () => {
    // Letters are the input widget's; it must keep receiving them.
    for (const key of ["a", "g", "x", "enter", "tab", "left", "right", "home"]) {
      expect(logScrollIntent(key, false, 20)).toBeUndefined();
    }
  });
});

describe("logScrollFromMouse", () => {
  it("scrolls backwards on a wheel up and forwards on a wheel down", () => {
    expect(logScrollFromMouse({ type: "scroll", scrollDelta: -1 })).toEqual({
      lines: -1,
      follow: false,
    });
    expect(logScrollFromMouse({ type: "scroll", scrollDelta: 1 })).toEqual({ lines: 1 });
  });

  it("ignores clicks, drags and empty scrolls", () => {
    for (const event of [
      { type: "mousedown", scrollDelta: -1 },
      { type: "drag", scrollDelta: 1 },
      { type: "scroll", scrollDelta: 0 },
      { type: "scroll" },
      {},
    ]) {
      expect(logScrollFromMouse(event)).toBeUndefined();
    }
  });
});
