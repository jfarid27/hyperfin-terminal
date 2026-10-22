import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { catchProgramError, reportError } from "./command_errors.ts";
import { catchAlpaca, ENTITLEMENT_HINT } from "./alpaca_errors.ts";
import { ConfigError, HTTPError } from "../errors/index.ts";
import {
  CommandResultType,
  DataSourceType,
  EnvironmentType,
  LogLevel,
  TerminalUserStateConfigContext,
  type TerminalUserStateConfig,
} from "../types.ts";

const state: TerminalUserStateConfig = {
  environment: EnvironmentType.Development,
  logLevel: LogLevel.None,
  sessionPath: "",
  apiKeys: {
    coingecko: undefined,
    alphavantage: undefined,
    blockchaincom: undefined,
    freecryptoapi: undefined,
    fred: undefined,
    massive: undefined,
    yahoofinance: undefined,
    alpaca: undefined,
    coinmarketcap: undefined,
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
    forex: { datasource: DataSourceType.AlphaVantage },
  },
  scriptContext: {},
};

const captureLog = () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  return {
    lines,
    text: () => lines.join("\n"),
    restore: () => {
      console.log = original;
    },
  };
};

const failed = { result: { type: CommandResultType.Success }, state };

describe("catchProgramError", () => {
  it("prints a missing AlphaVantage key with the variable to set", async () => {
    // The regression: mapErrorsToCommandResults reduced this to a bare Error
    // result, so both front ends showed only "Invalid command" and the user had
    // no idea the command never reached the network.
    const log = captureLog();
    try {
      const result = await Effect.runPromise(
        catchProgramError(
          Effect.fail(new ConfigError({ message: "Missing Alphavantage API Key." })) as Effect.Effect<
            typeof failed,
            ConfigError
          >,
          "AlphaVantage forex chart request failed.",
        ).pipe(Effect.provideService(TerminalUserStateConfigContext, state)),
      );

      expect(result.result.type).toBe(CommandResultType.Error);
      expect(result.state).toBe(state);
      expect(log.text()).toContain("AlphaVantage forex chart request failed.");
      expect(log.text()).toContain("Missing Alphavantage API Key.");
      expect(log.text()).toContain("ALPHAVANTAGE_API_KEY");
    } finally {
      log.restore();
    }
  });

  it("prints an HTTP error's own message", async () => {
    const log = captureLog();
    try {
      const result = await Effect.runPromise(
        catchProgramError(
          Effect.fail(new HTTPError({ message: "AlphaVantage forex chart unavailable: rate limit" })) as
            Effect.Effect<typeof failed, HTTPError>,
          "AlphaVantage forex chart request failed.",
        ).pipe(Effect.provideService(TerminalUserStateConfigContext, state)),
      );

      expect(result.result.type).toBe(CommandResultType.Error);
      expect(log.text()).toContain("rate limit");
    } finally {
      log.restore();
    }
  });

  it("passes a successful result through untouched", async () => {
    const log = captureLog();
    try {
      const result = await Effect.runPromise(
        catchProgramError(Effect.succeed(failed), "unused").pipe(
          Effect.provideService(TerminalUserStateConfigContext, state),
        ),
      );

      expect(result.result.type).toBe(CommandResultType.Success);
      expect(log.lines).toEqual([]);
    } finally {
      log.restore();
    }
  });
});

describe("catchAlpaca", () => {
  it("reports missing Alpaca credentials instead of swallowing them", async () => {
    // Only HTTPErrors used to be caught, so a missing key pair fell through to
    // the runner's generic "Invalid command".
    const log = captureLog();
    try {
      const result = await Effect.runPromise(
        catchAlpaca(
          Effect.fail(
            new ConfigError({
              message: "Missing Alpaca credentials (set ALPACA_API_KEY and ALPACA_API_SECRET).",
            }),
          ) as Effect.Effect<typeof failed, ConfigError>,
          "Alpaca forex chart request failed.",
        ).pipe(Effect.provideService(TerminalUserStateConfigContext, state)),
      );

      expect(result.result.type).toBe(CommandResultType.Error);
      expect(log.text()).toContain("Missing Alpaca credentials");
      expect(log.text()).toContain("ALPACA_API_SECRET");
    } finally {
      log.restore();
    }
  });

  it("keeps the entitlement hint for a 403", async () => {
    const log = captureLog();
    try {
      await Effect.runPromise(
        catchAlpaca(
          Effect.fail(new HTTPError({ message: "Alpaca (403) forbidden: insufficient grants" })) as Effect.Effect<
            typeof failed,
            HTTPError
          >,
          "Alpaca forex chart request failed.",
        ).pipe(Effect.provideService(TerminalUserStateConfigContext, state)),
      );

      expect(log.text()).toContain(ENTITLEMENT_HINT);
    } finally {
      log.restore();
    }
  });
});

describe("reportError", () => {
  it("returns a failed state carrying the state it was given", () => {
    const log = captureLog();
    try {
      const result = reportError(state, "fallback", "reason");
      expect(result.result.type).toBe(CommandResultType.Error);
      expect(result.state).toBe(state);
      expect(log.lines.length).toBe(2);
    } finally {
      log.restore();
    }
  });
});
