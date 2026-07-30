import chalk from "chalk";
import { lensPath, set, view } from "ramda";
import cryptoTerminal from "./CryptoMenu/index.ts";
import predictionMarketsTerminal from "./PredictionMarketMenu/index.ts";
import stocksTerminal from "./StocksMenu/index.ts";
import { menuGlobalsTop } from "./utils/menu_globals.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import newsTerminal from "./NewsMenu/index.ts";

import figlet from "figlet";

import {
    ENVIRONMENT, LOG_LEVEL,
    COINGECKO_API_KEY, ALPHAVANTAGE_API_KEY,
    BLOCKCHAINCOM_API_KEY, FREECRYPTOAPI_API_KEY,
    FRED_API_KEY,
    MASSIVE_API_KEY,
} from "./config.ts";

import { Menu, MenuOption, TerminalUserStateConfig, CommandResultType, LogLevel, EnvironmentType, CommandState, TerminalUserStateConfigContext } from "./types.ts";
import { registerTerminalApplication } from "./utils/program_loader.ts";
import { Effect } from "effect";
import { ConfigErrorTag, HTTPErrorTag, TimeoutErrorTag, UnknownError, UnknownErrorTag, type ProgramError } from "./errors/index.ts";

const menuOptions = (state: TerminalUserStateConfig): MenuOption[] => ([
    {
        name: "crypto",
        command: "crypto",
        description: "Fetch crypto prices from various sources",
        action: () => Effect.gen(function*() {
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
        action: () => Effect.gen(function*() {
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
        action: () => Effect.gen(function*() {
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
        name: "prediction markets",
        command: "predictions",
        description: "Fetch prediction markets prices from various sources",
        action: () => Effect.gen(function*() {
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
        name: "script",
        command: "script [filename]",
        description: "Run a script from the scripts folder with a specified filename",
        action: (filename: string) => Effect.gen(function*() {
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
                        }
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
        action: (keyType: string, value?: string) => Effect.gen(function*() {
            const st = yield* TerminalUserStateConfigContext;

            if (!keyType) {
                const availableKeys = Object.keys(st.apiKeys);
                console.log(chalk.green(`Available API keys: ${availableKeys.join(", ")}`));
                return {
                    result: { type: CommandResultType.Success },
                    state: st,
                };
            }

            const keyLens = lensPath(['apiKeys', keyType]);
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
    description: "Main Menu",
    messagePrompt: "Select an option:",
    options: menuOptions,
}

export const terminalMain = registerTerminalApplication(mainMenu);

export async function startMain(scriptFilename?: string) {
  // Only show banner on initial load
  console.log(chalk.green(figlet.textSync("Open Eth Terminal", { horizontalLayout: 'full' })));

  const logLevelMap: { [key: string]: LogLevel } = {
    "debug": LogLevel.Debug,
    "info": LogLevel.Info,
    "warning": LogLevel.Warning,
    "error": LogLevel.Error,
  };

  const environmentMap: { [key: string]: EnvironmentType } = {
    "development": EnvironmentType.Development,
    "production": EnvironmentType.Production,
  };


  const logLevel = (LOG_LEVEL && LOG_LEVEL in logLevelMap) ?
    logLevelMap[LOG_LEVEL] : 0;

  const environment = (ENVIRONMENT && ENVIRONMENT in environmentMap) ?
    environmentMap[ENVIRONMENT] : EnvironmentType.Production;

  const state: TerminalUserStateConfig = {
    environment: environment,
    logLevel: logLevel,
    apiKeys: {
        coingecko: COINGECKO_API_KEY,
        alphavantage: ALPHAVANTAGE_API_KEY,
        blockchaincom: BLOCKCHAINCOM_API_KEY,
        freecryptoapi: FREECRYPTOAPI_API_KEY,
        fred: FRED_API_KEY,
        massive: MASSIVE_API_KEY,
    },
    loadedContext: {},
    scriptContext: {}
  };

  try {
    await terminalMain(state);
  } catch (error) {
    console.error("Error in main terminal:", error);
    process.exit(1);
  }
}
