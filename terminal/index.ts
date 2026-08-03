/**
 * @file HyperFin Terminal — Bloomberg-style TUI entry point.
 *
 * Reuses the existing menu infrastructure (sub-terminals, actions, models)
 * but renders them in a full-screen Bloomberg-style TUI with:
 * - Data area showing the last command's output
 * - Command input line for typing commands
 * - Menu bar with keybindings at the bottom
 * - XMTP chat integration
 */

import chalk from "chalk";
import { lensPath, set, view } from "ramda";
import cryptoTerminal from "cli/CryptoMenu/index.ts";
import predictionMarketsTerminal from "cli/PredictionMarketMenu/index.ts";
import stocksTerminal from "cli/StocksMenu/index.ts";
import newsTerminal from "cli/NewsMenu/index.ts";
import { menuGlobalsTop } from "cli/utils/menu_globals.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  Menu, MenuOption, TerminalUserStateConfig,
  CommandResultType, EnvironmentType,
  CommandState, TerminalUserStateConfigContext,
  DataSourceType, logLevelFromEnv,
} from "cli/types.ts";
import { Effect } from "effect";
import { ConfigErrorTag, HTTPErrorTag, TimeoutErrorTag, UnknownError, UnknownErrorTag, type ProgramError } from "cli/errors/index.ts";
import { HyperFinTerminal } from "./HyperFinTerminal.ts";

/**
 * Menu options — same as the main terminal but adapted for the HyperFin TUI.
 */
const menuOptions = (state: TerminalUserStateConfig): MenuOption[] => ([
  {
    name: "crypto",
    command: "crypto",
    description: "Fetch crypto prices from various sources",
    action: () => Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      const newState = yield* Effect.promise(async () => cryptoTerminal(st));
      return {
        result: { type: CommandResultType.Success },
        state: newState,
      };
    }).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
        ),
},
  {
    name: "stocks",
    command: "stocks",
    description: "Fetch stock prices from various sources",
    action: () => Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      const newState = yield* Effect.promise(async () => stocksTerminal(st));
      return {
        result: { type: CommandResultType.Success },
        state: newState,
      };
    }).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
        ),
},
  {
    name: "news",
    command: "news",
    description: "Fetch news from various sources",
    action: () => Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      const newState = yield* Effect.promise(async () => newsTerminal(st));
      return {
        result: { type: CommandResultType.Success },
        state: newState,
      };
    }).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
        ),
},
  {
    name: "predictions",
    command: "predictions",
    description: "Fetch prediction markets prices from various sources",
    action: () => Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      const newState = yield* Effect.promise(async () => predictionMarketsTerminal(st));
      return {
        result: { type: CommandResultType.Success },
        state: newState,
      };
    }).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
        ),
},
  {
    name: "chat",
    command: "chat",
    description: "Open XMTP chat — message other users on the XMTP network",
    action: () => Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      // Chat is handled by the HyperFinTerminal directly — this action
      // just returns success so the terminal knows to enter chat mode.
      return {
        result: { type: CommandResultType.Success },
        state: st,
      };
    }).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
        ),
},
  {
    name: "script",
    command: "script [filename]",
    description: "Run a script from the scripts folder with a specified filename",
    action: (filename: string) => Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      try {
        const scriptPath = join(process.cwd(), "scripts", filename);
        const fileContent = yield* Effect.promise(() => readFile(scriptPath, "utf-8"));
        const [currentCommand, ...tailCommands] = fileContent.split("\n").map(l => l.trim()).filter(l => l.length > 0);

        return {
          result: { type: CommandResultType.Success },
          state: {
            ...st,
            scriptContext: {
              filename,
              currentCommand,
              tailCommands,
            },
          },
        };
      } catch (error) {
        console.log(chalk.red(`Failed to load script: ${error}`));
        return {
          result: { type: CommandResultType.Error },
          state: st,
        };
      }
    }).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
        ),
},
  {
    name: "keys",
    command: "keys [type] [value]",
    description: "Set or get the API keys",
    action: (keyType: string, value?: string) => Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;

      if (!keyType) {
        const availableKeys = Object.keys(st.apiKeys);
        console.log(chalk.green(`Available API keys: ${availableKeys.join(", ")}`));
        return {
          result: { type: CommandResultType.Success },
          state: st,
        };
      }

      const keyLens = lensPath(["apiKeys", keyType]);
      if (keyType && !value) {
        const apiKey = view(keyLens, st);
        console.log(chalk.green(`API Key for ${keyType} is ${apiKey}`));
        return {
          result: { type: CommandResultType.Success },
          state: st,
        };
      }
      const newState = set(keyLens, value, st);
      console.log(chalk.green(`API Key for ${keyType} set to ${value}`));
      return {
        result: { type: CommandResultType.Success },
        state: newState,
      };
    }).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
        ),
},
  ...menuGlobalsTop(state),
]);

const mainMenu: Menu = {
  name: "Main Menu",
  description: "HyperFin Terminal",
  messagePrompt: "Select an option:",
  options: menuOptions,
};

/**
 * Start the HyperFin terminal.
 */
export async function startHyperFin(scriptFilename?: string) {
  const environmentMap: { [key: string]: EnvironmentType } = {
    "development": EnvironmentType.Development,
    "production": EnvironmentType.Production,
  };

  const logLevel = logLevelFromEnv(process.env.LOG_LEVEL);

  const environment = (process.env.ENVIRONMENT && process.env.ENVIRONMENT in environmentMap)
    ? environmentMap[process.env.ENVIRONMENT]
    : EnvironmentType.Production;

  const state: TerminalUserStateConfig = {
    environment: environment,
    logLevel: logLevel,
    apiKeys: {
      coingecko: process.env.COINGECKO_API_KEY,
      alphavantage: process.env.ALPHAVANTAGE_API_KEY,
      blockchaincom: process.env.BLOCKCHAINCOM_API_KEY,
      freecryptoapi: process.env.FREECRYPTOAPI_API_KEY,
      fred: process.env.FRED_API_KEY,
      massive: process.env.MASSIVE_API_KEY,
    },
    loadedContext: {
      stocks: { datasource: DataSourceType.AlphaVantage },
      options: { datasource: DataSourceType.CBOE },
    },
    scriptContext: {},
  };

  const terminal = new HyperFinTerminal({
    title: "HyperFin Terminal",
    menu: mainMenu,
  });

  try {
    await terminal.run(state);
  } catch (error) {
    console.error("Error in HyperFin terminal:", error);
    process.exit(1);
  }
}
