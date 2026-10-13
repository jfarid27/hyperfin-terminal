import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import type { Menu, MenuOption, TerminalUserStateConfig } from "../types.ts";
import {
  CommandResultType,
  DataSourceType,
  EnvironmentType,
  LogLevel,
  TerminalUserStateConfigContext,
} from "../types.ts";
import { createMenuSession } from "./session.ts";
import { caretPathSegments, caretPathWidth } from "./path.ts";

const state: TerminalUserStateConfig = {
  environment: EnvironmentType.Development,
  logLevel: LogLevel.None,
  sessionPath: "sessions/test.jsonl",
  apiKeys: {
    coingecko: undefined,
    alphavantage: undefined,
    blockchaincom: undefined,
    freecryptoapi: undefined,
    fred: undefined,
    massive: undefined,
    yahoofinance: undefined,
    alpaca: undefined,
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
  },
  scriptContext: {},
};

const option = (command: string, extra: Partial<MenuOption> = {}): MenuOption => ({
  name: command.split(/\s+/)[0],
  command,
  description: `${command} description`,
  action: () =>
    Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      return { result: { type: CommandResultType.Success }, state: st };
    }),
  ...extra,
});

const cryptoMenu: Menu = {
  name: "Crypto Menu",
  description: "crypto",
  messagePrompt: ">",
  options: () => [option("price [symbol]")],
};

const mainMenu: Menu = {
  name: "Main Menu",
  description: "main",
  messagePrompt: ">",
  options: () => [
    option("crypto", { submenu: () => cryptoMenu }),
    option("keys [type] [value]"),
    option("source [datatypeSource]"),
  ],
};

describe("createMenuSession", () => {
  it("starts pointed at the root menu", () => {
    const session = createMenuSession(mainMenu, state);
    expect(session.current()).toBe(mainMenu);
    expect(session.depth()).toBe(1);
    expect(session.pathSegments()).toEqual(["hyperfin", "main", ""]);
  });

  it("enters a child menu and widens the prompt", () => {
    const session = createMenuSession(mainMenu, state);
    const before = session.promptWidth();

    session.enter(cryptoMenu);

    expect(session.depth()).toBe(2);
    expect(session.current()).toBe(cryptoMenu);
    expect(session.pathSegments()).toEqual(["hyperfin", "main", "crypto", ""]);
    expect(session.promptWidth()).toBeGreaterThan(before);
    expect(session.promptWidth()).toBe(
      caretPathWidth(caretPathSegments([mainMenu, cryptoMenu])),
    );
  });

  it("pops back out, and refuses to pop past the root", () => {
    const session = createMenuSession(mainMenu, state);
    session.enter(cryptoMenu);

    expect(session.back()).toBe(true);
    expect(session.current()).toBe(mainMenu);
    expect(session.back()).toBe(false);
    expect(session.depth()).toBe(1);
  });

  it("lists the current menu's options for the current state", () => {
    const session = createMenuSession(mainMenu, state);
    expect(session.options().map((o) => o.command)).toEqual([
      "crypto",
      "keys [type] [value]",
      "source [datatypeSource]",
    ]);

    session.enter(cryptoMenu);
    expect(session.options().map((o) => o.command)).toEqual(["price [symbol]"]);
  });

  it("hands the log a heading and the menu's rows", () => {
    const session = createMenuSession(mainMenu, state);
    const lines = session.menuLines();
    expect(lines[0]).toBe("");
    expect(lines[1]).toBe("Main Menu");
    expect(lines).toHaveLength(2 + session.options().length);
  });

  it("consumes a script one line at a time", () => {
    const scripted: TerminalUserStateConfig = {
      ...state,
      scriptContext: {
        filename: "demo.txt",
        currentCommand: "stocks",
        tailCommands: ["spot NVDA", "back"],
      },
    };
    const session = createMenuSession(mainMenu, scripted);

    expect(session.state.scriptContext?.currentCommand).toBe("stocks");

    session.consumeScriptLine();
    expect(session.state.scriptContext?.currentCommand).toBe("spot NVDA");
    expect(session.state.scriptContext?.tailCommands).toEqual(["back"]);

    session.consumeScriptLine();
    expect(session.state.scriptContext?.currentCommand).toBe("back");
    expect(session.state.scriptContext?.tailCommands).toEqual([]);

    // Running out of lines is how a script is known to be finished.
    session.consumeScriptLine();
    expect(session.state.scriptContext?.currentCommand).toBeUndefined();
  });

  it("clears the script without touching the rest of the state", () => {
    const scripted: TerminalUserStateConfig = {
      ...state,
      scriptContext: { filename: "demo.txt", currentCommand: "stocks" },
    };
    const session = createMenuSession(mainMenu, scripted);

    session.clearScript();

    expect(session.state.scriptContext).toEqual({});
    expect(session.state.sessionPath).toBe(state.sessionPath);
  });

  it("returns to the root menu from any depth", () => {
    const session = createMenuSession(mainMenu, state);
    session.enter(cryptoMenu);
    session.enter(cryptoMenu);

    session.resetToRoot();

    expect(session.depth()).toBe(1);
    expect(session.current()).toBe(mainMenu);
    expect(session.pathSegments()).toEqual(["hyperfin", "main", ""]);
  });

  it("adopts state returned by a command", () => {
    const session = createMenuSession(mainMenu, state);
    const next = { ...state, sessionPath: "sessions/next.jsonl" };
    session.setState(next);
    expect(session.state.sessionPath).toBe("sessions/next.jsonl");
  });
});

describe("MenuSession.classify", () => {
  it("ignores empty input", () => {
    const session = createMenuSession(mainMenu, state);
    expect(session.classify("   ").kind).toBe("empty");
  });

  it("reports input that names no option on this menu", () => {
    const session = createMenuSession(mainMenu, state);
    const submission = session.classify("bogus");
    expect(submission.kind).toBe("unknown");
    expect(submission.input).toBe("bogus");
  });

  it("hops into a submenu on a bare name", () => {
    const session = createMenuSession(mainMenu, state);
    const submission = session.classify("crypto");
    expect(submission.kind).toBe("navigate");
    expect(submission.target).toBe(cryptoMenu);
  });

  it("dispatches a bare command", () => {
    const session = createMenuSession(mainMenu, state);
    expect(session.classify("keys").kind).toBe("dispatch");
  });

  it("dispatches a command that takes arguments rather than navigating", () => {
    const session = createMenuSession(mainMenu, state);
    const submission = session.classify("source massive");
    expect(submission.kind).toBe("dispatch");
    expect(submission.input).toBe("source massive");
  });
});
