/**
 * The stocks technicals submenu definitions.
 *
 * Split out of `index.ts` so the option list (names, command shapes) can be
 * asserted on without booting the terminal runner — importing `index.ts` pulls
 * in `registerTerminalApplication`, which starts an input loop.
 */

import {
  type CommandState,
  type MenuOption,
  type TerminalUserStateConfig,
  TerminalUserStateConfigContext,
} from "../../types.ts";
import type { ProgramError } from "../../errors/index.ts";
import { menuGlobals } from "../../utils/menu_globals.ts";
import { bollingerHandler, fibonacciHandler } from "../actions/technicals.ts";
import { StocksServiceLive } from "../services/index.ts";
import { Effect } from "effect";

export const bbandsOption: MenuOption = {
  name: "bbands",
  command: "bbands [symbol] [period] [stddev]",
  description: `Bollinger Bands over the price series.

    symbol (optional): falls back to the loaded token.
    period (optional): moving-average window, default 20.
    stddev (optional): envelope width in standard deviations, default 2.`,
  action: (
    symbolStr?: string,
    periodStr?: string,
    stddevStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      return yield* bollingerHandler(symbolStr, periodStr, stddevStr);
    }).pipe(Effect.provide(StocksServiceLive)),
};

export const fibonacciOption: MenuOption = {
  name: "fibonacci",
  command: "fibonacci [symbol] [lookback]",
  description: `Fibonacci retracement levels over the latest swing.

    symbol (optional): falls back to the loaded token.
    lookback (optional): swing window in bars, default the whole series.`,
  action: (
    symbolStr?: string,
    lookbackStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      return yield* fibonacciHandler(symbolStr, lookbackStr);
    }).pipe(Effect.provide(StocksServiceLive)),
};

/** The indicator options, in menu order. */
export const technicalsMenuOptions = (
  state: TerminalUserStateConfig,
): MenuOption[] => [bbandsOption, fibonacciOption, ...menuGlobals(state)];
