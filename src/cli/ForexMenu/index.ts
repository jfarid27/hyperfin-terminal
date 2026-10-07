import { registerTerminalApplication } from "../utils/program_loader.ts";
import {
  Menu,
  MenuOption,
  TerminalUserStateConfig,
} from "src/cli/types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { forexChartHandler, forexSpotHandler } from "./actions/alphavantage.ts";
import { Effect } from "effect";
import { ForexServiceMenuLive } from "./services/index.ts";

/**
 * Latest spot exchange rate for a currency pair.
 * Falls back to a usage message when the pair is not fully specified.
 */
const spotHandler = (fromStr?: string, toStr?: string) =>
  Effect.gen(function* () {
    return yield* forexSpotHandler(fromStr, toStr);
  }).pipe(Effect.provide(ForexServiceMenuLive));

/**
 * Daily FX chart for a currency pair over an optional date range.
 */
const chartHandler = (
  fromStr?: string,
  toStr?: string,
  dateFrom?: string,
  dateTo?: string,
) =>
  Effect.gen(function* () {
    return yield* forexChartHandler(fromStr, toStr, dateFrom, dateTo);
  }).pipe(Effect.provide(ForexServiceMenuLive));

const forexMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
  {
    name: "spot",
    command: "spot [from] [to]",
    description: "Fetch the current spot exchange rate for a currency pair (e.g. spot EUR USD)",
    action: spotHandler,
  },
  {
    name: "chart",
    command: "chart [from] [to] [fromDate] [toDate]",
    description: "Chart daily FX prices for a currency pair (dates YYYY-MM-DD; default last 1 year)",
    action: chartHandler,
  },
  ...menuGlobals(state),
];

const forexMenu: Menu = {
  name: "Forex Menu",
  description: "Foreign exchange rates and charts",
  messagePrompt: "Select an option:",
  options: forexMenuOptions,
};

export const forexTerminal = registerTerminalApplication(forexMenu);
export default forexTerminal;
