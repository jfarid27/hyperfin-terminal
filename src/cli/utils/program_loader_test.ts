import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ActionOptions, Menu, TerminalUserStateConfig } from "../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../types.ts";
import { clearScript, registerTerminalApplication, scriptFinished } from "./program_loader.ts";

// ── Fixtures ──

/**
 * The menu loop forks one commander registration per option and only awaits
 * them at the session-log write, so a state with no session path registers
 * nothing before the command is dispatched. Give the loop a real log target.
 */
const sessionDir = Deno.makeTempDirSync({ prefix: "program_loader_test" });
const sessionPath = join(sessionDir, "session.jsonl");

const baseState: TerminalUserStateConfig = {
  environment: EnvironmentType.Development,
  logLevel: LogLevel.None,
  sessionPath,
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

const stateWith = (
  scriptContext: TerminalUserStateConfig["scriptContext"],
): TerminalUserStateConfig => ({ ...baseState, scriptContext });

describe("scriptFinished", () => {
  it("is false while the script still has a command to run", () => {
    expect(
      scriptFinished(
        stateWith({
          filename: "daily.txt",
          currentCommand: "stocks",
          tailCommands: ["chart NVDA"],
        }),
      ),
    ).toBe(false);
  });

  it("is true once the script's commands are exhausted", () => {
    // The last command ran inside a submenu: the filename stays behind with
    // nothing left to execute.
    expect(
      scriptFinished(stateWith({ filename: "daily.txt", tailCommands: [] })),
    ).toBe(true);
  });

  it("is false for an empty script context", () => {
    expect(scriptFinished(baseState)).toBe(false);
    expect(scriptFinished(stateWith({}))).toBe(false);
  });

  it("is false for a command that is not part of a script", () => {
    expect(scriptFinished(stateWith({ currentCommand: "stocks" }))).toBe(false);
  });
});

describe("clearScript", () => {
  it("drops the finished script without touching the rest of the state", () => {
    const cleared = clearScript(
      stateWith({ filename: "daily.txt", tailCommands: [], exitAfterCompletion: true }),
    );

    expect(cleared.scriptContext).toEqual({});
    expect(cleared.sessionPath).toBe(baseState.sessionPath);
    expect(cleared.apiKeys).toEqual(baseState.apiKeys);
    expect(cleared.loadedContext).toEqual(baseState.loadedContext);
  });
});

describe("registerTerminalApplication", () => {
  const countingMenu = (): { menu: Menu; builds: () => number } => {
    let builds = 0;
    return {
      menu: {
        name: "Nested Menu",
        description: "Nested Menu",
        messagePrompt: ">",
        options: () => {
          builds++;
          return [];
        },
      },
      builds: () => builds,
    };
  };

  it("hands a finished script back to the enclosing menu instead of showing itself", async () => {
    const { menu, builds } = countingMenu();
    const nestedTerminal = registerTerminalApplication(menu);
    const finished = stateWith({ filename: "daily.txt", tailCommands: [] });

    const result = await Effect.runPromise(nestedTerminal(finished));

    // The submenu never renders, and the script state keeps travelling up so
    // every enclosing menu unwinds the same way.
    expect(builds()).toBe(0);
    expect(result).toEqual(finished);
    expect(scriptFinished(result)).toBe(true);
  });

  it("leaves a live script in the current menu", async () => {
    const menu: Menu = {
      name: "Script Menu",
      description: "Script Menu",
      messagePrompt: ">",
      options: () => [{
        name: "showconfig",
        command: "showconfig",
        description: "Show the current configuration",
        action: (_ops?: ActionOptions) => Effect.gen(function* () {
          return {
            result: { type: CommandResultType.Back },
            state: baseState,
          };
        }),
      }],
    };
    const terminal = registerTerminalApplication(menu);
    const running = stateWith({
      filename: "daily.txt",
      currentCommand: "showconfig",
      tailCommands: [],
    });

    // A live script reaches the input handling of its own menu rather than
    // unwinding, so its command is dispatched from there.
    const result = await Effect.runPromise(terminal(running));

    expect(result).toEqual(baseState);
  });
});
