import chalk from "chalk";
import { lensPath, set, view } from "ramda";
import cryptoTerminal from "./CryptoMenu/index.ts";
import predictionMarketsTerminal from "./PredictionMarketMenu/index.ts";
import stocksTerminal from "./StocksMenu/index.ts";
import optionsTerminal from "./OptionsMenu/index.ts";
import bondsTerminal from "./BondsMenu/index.ts";
import { menuGlobalsTop } from "./utils/menu_globals.ts";
import newsTerminal from "./NewsMenu/index.ts";
import { executeScript } from "./utils/scripts.ts";
import governmentTerminal from "./GovernmentMenu/index.ts";
import figlet from "figlet";
import {
  type Menu, type MenuOption, type TerminalUserStateConfig,
  CommandResultType, EnvironmentType, TerminalUserStateConfigContext, DataSourceType,
  logLevelFromEnv,
} from "./types.ts";
import { registerTerminalApplication } from "./utils/program_loader.ts";
import { Effect } from "effect";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const menuOptions = (state: TerminalUserStateConfig): MenuOption[] => ([
    {
        name: "crypto",
        command: "crypto",
        description: "Fetch crypto prices from various sources",
        action: () => Effect.gen(function*() {
            const st = yield* TerminalUserStateConfigContext;
            const newState = yield* cryptoTerminal(st);
            return {
                result: { type: CommandResultType.Success },
                state: newState,
            };
        })
    },
    {
        name: "stocks",
        command: "stocks",
        description: "Fetch stock prices from various sources",
        action: () => Effect.gen(function*() {
            const st = yield* TerminalUserStateConfigContext;
            const newState = yield* stocksTerminal(st);
            return {
                result: { type: CommandResultType.Success },
                state: newState,
            };
        })
    },
    {
        name: "government",
        command: "government",
        description: "Fetch government bond yields from Yahoo Finance",
        action: () => Effect.gen(function*() {
            const st = yield* TerminalUserStateConfigContext;
            const newState = yield* governmentTerminal(st);
            return {
                result: { type: CommandResultType.Success },
                state: newState,
            };
        })
    },
    {
        name: "options",
        command: "options",
        description: "Fetch options chains from Yahoo Finance",
        action: () => Effect.gen(function*() {
            const st = yield* TerminalUserStateConfigContext;
            const newState = yield* optionsTerminal(st);
            return {
                result: { type: CommandResultType.Success },
                state: newState,
            };
        })
    },
    {
        name: "bonds",
        command: "bonds",
        description: "Fetch bond yields from Yahoo Finance",
        action: () => Effect.gen(function*() {
            const st = yield* TerminalUserStateConfigContext;
            const newState = yield* bondsTerminal(st);
            return {
                result: { type: CommandResultType.Success },
                state: newState,
            };
        })
    },
    {
        name: "news",
        command: "news",
        description: "Fetch news from various sources",
        action: () => Effect.gen(function*() {
            const st = yield* TerminalUserStateConfigContext;
            const newState = yield* newsTerminal(st);
            return {
                result: { type: CommandResultType.Success },
                state: newState,
            };
        })
    },
    {
        name: "prediction markets",
        command: "predictions",
        description: "Fetch prediction markets prices from various sources",
        action: () => Effect.gen(function*() {
            const st = yield* TerminalUserStateConfigContext;
            const newState = yield* predictionMarketsTerminal(st);
            return {
                result: { type: CommandResultType.Success },
                state: newState,
            };
        })
    },
    {
        name: "script",
        command: "script [filename]",
        description: "Run a script from the scripts folder with a specified filename",
        action: executeScript
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
        })
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

export async function startMain(sessionPath: string, scriptFilename?: string) {
  // Only show banner on initial load, and only in interactive TTY mode.
  if (Deno.stdin.isTerminal()) {
    console.log(chalk.green(figlet.textSync("Hyperfin Terminal", { horizontalLayout: 'full' })));
  }

  const logLevel = logLevelFromEnv(process.env.LOG_LEVEL);

  const environmentMap: { [key: string]: EnvironmentType } = {
    "development": EnvironmentType.Development,
    "production": EnvironmentType.Production,
  };

  const environment = (process.env.ENVIRONMENT && process.env.ENVIRONMENT in environmentMap) ?
    environmentMap[process.env.ENVIRONMENT] : EnvironmentType.Production;

  // Build script context from --oet-script flag.
  let scriptContext = {};
  if (scriptFilename) {
    try {
      const scriptPath = join(process.cwd(), "scripts", scriptFilename);
      const content = await readFile(scriptPath, "utf-8");
      const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      const [currentCommand, ...tailCommands] = lines;
      scriptContext = {
        filename: scriptFilename,
        currentCommand,
        tailCommands,
        exitAfterCompletion: true,
      };
    } catch {
      console.error(chalk.red(`Failed to load script: ${scriptFilename}`));
      process.exit(1);
    }
  }

  const state: TerminalUserStateConfig = {
    environment: environment,
    logLevel: logLevel,
    sessionPath: sessionPath,
    apiKeys: {
        coingecko: process.env.COINGECKO_API_KEY,
        alphavantage: process.env.ALPHAVANTAGE_API_KEY,
        blockchaincom: process.env.BLOCKCHAINCOM_API_KEY,
        freecryptoapi: process.env.FREECRYPTOAPI_API_KEY,
        fred: process.env.FRED_API_KEY,
        massive: process.env.MASSIVE_API_KEY,
        yahoofinance: process.env.YAHOOFINANCE_API_KEY,
    },
    loadedContext: {
      stocks: { datasource: DataSourceType.AlphaVantage },
      options: { datasource: DataSourceType.YahooFinance },
    },
    scriptContext,
  };

  try {
    await Effect.runPromise(terminalMain(state));
  } catch (error) {
    console.error("Error in main terminal:", error);
    process.exit(1);
  }
}
