import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, TerminalUserStateConfigContext, CommandResultType } from "src/cli/types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { yieldsHandler } from "./actions/yields.ts";
import { bondSpotHandler } from "./actions/alpaca.ts";
import { Effect, Schema } from "effect";
import { lensPath, set } from "ramda";
import { DataSourceType } from "src/cli/types.ts";
import { BondsDataSourceTypeSchema, type BondsDataSourceType } from "../../services/BondsService/types.ts";
import { BondsServiceLive } from "../../services/BondsService/index.ts";
import { catchAlpaca } from "../utils/alpaca_errors.ts";
import chalk from "chalk";

const datasourceTypeLens = lensPath(["loadedContext", "bonds", "datasource"]);

/**
 * Dispatch the `yields` command to the active source:
 *   - Yahoo Finance (default): yield chart for US2/US5/US10/US30.
 *   - Alpaca: latest fixed-income price/yield by ISIN (no historical endpoint).
 */
const yieldsDispatcher = (bondCode: string, range?: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const datasource = st.loadedContext.bonds?.datasource ?? DataSourceType.YahooFinance;
  yield* Effect.logInfo(`Fetching data from ${datasource}`);

  if (datasource === DataSourceType.Alpaca) {
    return yield* catchAlpaca(bondSpotHandler(bondCode), "Alpaca fixed-income request failed.");
  }

  return yield* yieldsHandler(bondCode, range);
}).pipe(Effect.provide(BondsServiceLive));

/** Switch the source of bond data. */
const datasourceSwapHandler = (datatypeStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  if (!datatypeStr) {
    console.log(chalk.red("No source provided."));
    return { result: { type: CommandResultType.Error }, state: st };
  }
  yield* Effect.logDebug(`Swapping datasource to ${datatypeStr}`);

  const updatedE = Schema.decodeUnknownEither(BondsDataSourceTypeSchema)(datatypeStr);
  const val = yield* updatedE;

  const updatedSt = set<TerminalUserStateConfig, BondsDataSourceType>(datasourceTypeLens, val, st);
  console.log(chalk.green(`Swapped datasource to ${val}`));
  return { result: { type: CommandResultType.Success }, state: updatedSt };
}).pipe(
  Effect.catchTag("ParseError", (_err) => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    console.log(chalk.red("Invalid source provided."));
    return { result: { type: CommandResultType.Error }, state: st };
  })),
);

const bondsMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
  {
    name: "yields",
    command: "yields <code> [range]",
    description: "Yahoo: yield chart for US2/US5/US10/US30. Alpaca: latest price/yield by ISIN (e.g. US912797KJ59).",
    action: yieldsDispatcher,
  },
  {
    name: "source",
    command: "source [datatypeSource]",
    description: "Switch the source of data between: yahoofinance, alpaca.",
    action: datasourceSwapHandler,
  },
  ...menuGlobals(state),
];

const bondsMenu: Menu = {
  name: "Bonds Menu",
  description: "Bonds Menu",
  messagePrompt: "Select an option:",
  options: bondsMenuOptions,
};

export const bondsTerminal = registerTerminalApplication(bondsMenu);
export default bondsTerminal;
