import chalk from "chalk";
import { Effect } from "effect";
import { lensPath, set, view } from "ramda";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import figlet from "figlet";
import cryptoTerminal, { cryptoMenu } from "./CryptoMenu/index.ts";
import predictionMarketsTerminal, { predictionMarketsMenu } from "./PredictionMarketMenu/index.ts";
import stocksTerminal, { stocksMenu } from "./StocksMenu/index.ts";
import optionsTerminal, { optionsMenu } from "./OptionsMenu/index.ts";
import bondsTerminal, { bondsMenu } from "./BondsMenu/index.ts";
import governmentTerminal, { governmentMenu } from "./GovernmentMenu/index.ts";
import newsTerminal, { newsMenu } from "./NewsMenu/index.ts";
import forexTerminal, { forexMenu } from "./ForexMenu/index.ts";
import { menuGlobalsTop } from "./utils/menu_globals.ts";
import { executeScript } from "./utils/scripts.ts";
import {
  type Menu, type MenuOption, type ScriptContext, type TerminalUserStateConfig,
  CommandResultType, EnvironmentType, TerminalUserStateConfigContext, DataSourceType,
  APIKeyType,
  logLevelFromEnv,
} from "./types.ts";
import { API_KEY_ENV_VAR } from "./services/ConfigService.ts";
import { registerTerminalApplication } from "./utils/program_loader.ts";
import { preparePackages, reportPackages } from "./packages/index.ts";
import { packageMenuOptions } from "./packages/menu.ts";
import { canRunTermui, startTermuiApp } from "./termui/index.ts";

/** A registered menu application: run it and get the state back. */
type MenuTerminal = (
  st: TerminalUserStateConfig,
) => Effect.Effect<TerminalUserStateConfig>;

/**
 * A top-level option that opens a child menu.
 *
 * Same edge, two views. `action` is the classic path the terminal-kit loop
 * takes: enter the child by running the child's own registered application,
 * which reads its own input. `submenu` states the same edge as data, so the
 * termui shell can render the child menu itself and keep its single input bar.
 * Both loops read one declaration, and a menu is a single line here.
 */
const submenuOption = (
  name: string,
  command: string,
  description: string,
  childMenu: Menu,
  childTerminal: MenuTerminal,
): MenuOption => ({
  name,
  command,
  description,
  action: () => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const newState = yield* childTerminal(st);
    return {
      result: { type: CommandResultType.Success },
      state: newState,
    };
  }),
  submenu: () => childMenu,
});

const builtinMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => ([
    submenuOption(
        "crypto", "crypto", "Fetch crypto prices from various sources",
        cryptoMenu, cryptoTerminal,
    ),
    submenuOption(
        "stocks", "stocks", "Fetch stock prices from various sources",
        stocksMenu, stocksTerminal,
    ),
    submenuOption(
        "government", "government", "Fetch government bond yields from Yahoo Finance",
        governmentMenu, governmentTerminal,
    ),
    submenuOption(
        "options", "options", "Fetch options chains from Yahoo Finance",
        optionsMenu, optionsTerminal,
    ),
    submenuOption(
        "forex", "forex", "Fetch foreign exchange rates and charts",
        forexMenu, forexTerminal,
    ),
    submenuOption(
        "bonds", "bonds", "Fetch bond yields from Yahoo Finance",
        bondsMenu, bondsTerminal,
    ),
    submenuOption(
        "news", "news", "Fetch news from various sources",
        newsMenu, newsTerminal,
    ),
    submenuOption(
        "prediction markets", "predictions",
        "Fetch prediction markets prices from various sources",
        predictionMarketsMenu, predictionMarketsTerminal,
    ),
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
            // Data services read credentials from `ConfigService` (i.e.
            // `process.env`), not from `st.apiKeys`, so mirror the value into
            // the environment or this command sets state nothing reads.
            const envNames = API_KEY_ENV_VAR[keyType as APIKeyType] ?? [];
            for (const envName of envNames) process.env[envName] = value;
            const applied = envNames.length > 0
              ? chalk.dim(`  (applied to ${envNames.join(", ")} in this session)`)
              : chalk.dim(`  (no environment variable backs "${keyType}")`);
            console.log(chalk.green(`API Key for ${keyType} set to ${value}`));
            console.log(applied);
            return {
                result: { type: CommandResultType.Success },
                state: newState,
            };
        })
    },
    ...menuGlobalsTop(state),
]);

/**
 * Menu options contributed by packages under the `hyperfin-packages`
 * folder. Populated once by {@link startMain} before the menu loop starts;
 * the main menu's options closure reads this shared reference so
 * `terminalMain` stays a plain `registerTerminalApplication` factory and
 * script runners (which call it directly) still work.
 */
let packageOptions: MenuOption[] = [];

/**
 * Command tokens a package may not claim: every built-in top-level command
 * (including the globals). A colliding package is skipped at discovery.
 */
const reservedCommands = (state: TerminalUserStateConfig): string[] =>
    builtinMenuOptions(state).map((option) => option.command.split(/\s+/)[0]);

const menuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    ...builtinMenuOptions(state),
    ...packageOptions,
];

export const mainMenu: Menu = {
    name: "Main Menu",
    description: "Main Menu",
    messagePrompt: "Select an option:",
    options: menuOptions,
}

export const terminalMain = registerTerminalApplication(mainMenu, { isRoot: true });

/**
 * Build the script context for a `--oet-script` / `script` run.
 *
 * A missing script exits: the flag was explicit, so silently starting an
 * interactive session instead would hide the typo.
 */
const loadScriptContext = async (
  scriptFilename?: string,
): Promise<ScriptContext> => {
  if (!scriptFilename) return {};
  try {
    const scriptPath = join(process.cwd(), "scripts", scriptFilename);
    const content = await readFile(scriptPath, "utf-8");
    const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const [currentCommand, ...tailCommands] = lines;
    return {
      filename: scriptFilename,
      currentCommand,
      tailCommands,
      exitAfterCompletion: true,
    };
  } catch {
    console.error(chalk.red(`Failed to load script: ${scriptFilename}`));
    process.exit(1);
  }
};

/**
 * The application state both entry points start from: environment, log level,
 * API keys, the default data sources, the script context, and the menus
 * contributed by packages under `hyperfin-packages/`.
 */
const prepareInitialState = async (
  sessionPath: string,
  scriptFilename?: string,
): Promise<TerminalUserStateConfig> => {
  const logLevel = logLevelFromEnv(process.env.LOG_LEVEL);

  const environmentMap: { [key: string]: EnvironmentType } = {
    "development": EnvironmentType.Development,
    "production": EnvironmentType.Production,
  };

  const environment = (process.env.ENVIRONMENT && process.env.ENVIRONMENT in environmentMap) ?
    environmentMap[process.env.ENVIRONMENT] : EnvironmentType.Production;

  const scriptContext = await loadScriptContext(scriptFilename);

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
        alpaca: process.env.ALPACA_API_KEY,
        coinmarketcap: process.env.CMC_API_KEY,
    },
    loadedContext: {
      stocks: { datasource: DataSourceType.AlphaVantage },
      options: { datasource: DataSourceType.YahooFinance },
      bonds: { datasource: DataSourceType.YahooFinance },
      forex: { datasource: DataSourceType.AlphaVantage },
      dex: { datasource: DataSourceType.CoinMarketCap },
    },
    scriptContext,
  };

  // Discover and register package menus under `hyperfin-packages/`.
  // Discovery reads manifests only; entries are imported lazily on first
  // use, so a broken package can never prevent the terminal from starting.
  const { discovery, loaded, notes } = await preparePackages(
    reservedCommands(state),
  );
  packageOptions = packageMenuOptions(loaded.packages, discovery.root);
  reportPackages(discovery, loaded, notes);

  return state;
};

/**
 * Start the application.
 *
 * An interactive terminal gets the full-screen termui shell. Everything else —
 * piped input, `--oet-script`, cron — keeps the line-based loop, which reads one
 * command per menu level. The shell needs a terminal on both ends and somebody
 * at the input bar, so a script run is never handed to it.
 *
 * `--line` forces the line-based loop on a terminal, for anyone who wants their
 * scrollback rather than the full-screen frame.
 */
export async function startMain(
  sessionPath: string,
  scriptFilename?: string,
  options: { line?: boolean } = {},
) {
  const interactive = !options.line && !scriptFilename && canRunTermui();

  if (!interactive) {
    // The banner is for the line-based loop: the shell draws its own header,
    // and on a piped run there is no terminal to draw it on.
    if (Deno.stdin.isTerminal()) {
      console.log(chalk.green(figlet.textSync("Hyperfin Terminal", { horizontalLayout: "full" })));
    }

    const state = await prepareInitialState(sessionPath, scriptFilename);
    try {
      await Effect.runPromise(terminalMain(state));
    } catch (error) {
      console.error("Error in main terminal:", error);
      process.exit(1);
    }
    return;
  }

  const state = await prepareInitialState(sessionPath);
  try {
    await startTermuiApp(mainMenu, state);
  } catch (error) {
    console.error("Error in termui shell:", error);
    process.exit(1);
  }
}
