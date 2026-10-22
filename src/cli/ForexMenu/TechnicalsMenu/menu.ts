/**
 * The forex technicals submenu definitions.
 *
 * Split out of `index.ts` so the option list (names, command shapes) can be
 * asserted on without booting the terminal runner — importing `index.ts` pulls
 * in `registerTerminalApplication`, which starts an input loop.
 *
 * Every command takes the currency pair first, then the indicator's own
 * parameters: `bbands EUR USD 20 2`, `fibonacci EUR USD 120`, `returns EUR USD`.
 * The arguments are declared optional so a bare invocation reaches the
 * handler's own guard instead of making commander `exitOverride` throw.
 */

import {
  type CommandState,
  type MenuOption,
  type TerminalUserStateConfig,
  TerminalUserStateConfigContext,
  DataSourceType,
} from "../../types.ts";
import type { ProgramError } from "../../errors/index.ts";
import { menuGlobals } from "../../utils/menu_globals.ts";
import { bollingerHandler, fibonacciHandler, returnsHandler } from "../actions/technicals.ts";
import { ForexServiceMenuLive } from "../services/index.ts";
import { catchAlpaca } from "../../utils/alpaca_errors.ts";
import { catchProgramError } from "../../utils/command_errors.ts";
import { Effect } from "effect";

/**
 * Run one indicator against the active forex source and report its failure.
 *
 * The forex menu can be pointed at either source, and each fails in its own way
 * — a missing `ALPHAVANTAGE_API_KEY` versus Alpaca's missing key pair, a bad
 * pair or a 403 entitlement. Both recoveries print the source's own message
 * instead of letting the runner reduce it to a bare `Invalid command`.
 */
const withActiveSource = <R>(
  run: () => Effect.Effect<CommandState, ProgramError, R>,
  label: string,
): Effect.Effect<CommandState, ProgramError, R | TerminalUserStateConfigContext> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const datasource = st.loadedContext.forex?.datasource ?? DataSourceType.AlphaVantage;

    if (datasource === DataSourceType.Alpaca) {
      return yield* catchAlpaca(run(), `Alpaca forex ${label} request failed.`);
    }
    return yield* catchProgramError(run(), `AlphaVantage forex ${label} request failed.`);
  });

export const bbandsOption: MenuOption = {
  name: "bbands",
  command: "bbands [from] [to] [period] [stddev]",
  description: `Bollinger Bands over a pair's daily rate.

    from / to (required): ISO 4217 codes, e.g. bbands EUR USD.
    period (optional): moving-average window, default 20.
    stddev (optional): envelope width in standard deviations, default 2.`,
  action: (
    fromStr?: string,
    toStr?: string,
    periodStr?: string,
    stddevStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    withActiveSource(
      () => bollingerHandler(fromStr, toStr, periodStr, stddevStr),
      "Bollinger Bands",
    ).pipe(Effect.provide(ForexServiceMenuLive)),
};

export const fibonacciOption: MenuOption = {
  name: "fibonacci",
  command: "fibonacci [from] [to] [lookback]",
  description: `Fibonacci retracement levels over the pair's latest swing.

    from / to (required): ISO 4217 codes, e.g. fibonacci EUR USD.
    lookback (optional): swing window in bars, default the trailing year (~252 bars).`,
  action: (
    fromStr?: string,
    toStr?: string,
    lookbackStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    withActiveSource(
      () => fibonacciHandler(fromStr, toStr, lookbackStr),
      "Fibonacci retracement",
    ).pipe(Effect.provide(ForexServiceMenuLive)),
};

export const returnsOption: MenuOption = {
  name: "returns",
  command: "returns [from] [to]",
  description: `Daily percent returns of the pair's rate (each close against the previous close).

    from / to (required): ISO 4217 codes, e.g. returns EUR USD.`,
  action: (
    fromStr?: string,
    toStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    withActiveSource(
      () => returnsHandler(fromStr, toStr),
      "daily returns",
    ).pipe(Effect.provide(ForexServiceMenuLive)),
};

/** The indicator options, in menu order. */
export const technicalsMenuOptions = (
  state: TerminalUserStateConfig,
): MenuOption[] => [bbandsOption, fibonacciOption, returnsOption, ...menuGlobals(state)];
