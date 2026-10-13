/**
 * The Ethereum technicals submenu definitions.
 *
 * Split out of `index.ts` so the option list (names, command shapes) can be
 * asserted on without booting the terminal runner — importing `index.ts` pulls
 * in `registerTerminalApplication`, which starts an input loop.
 *
 * Mirror of the crypto technicals menu, with the symbol replaced by a contract
 * address: every option takes an optional leading address that falls back to
 * the loaded DEX address, then the indicator's own parameters.
 */

import {
  type CommandState,
  type MenuOption,
  type TerminalUserStateConfig,
  // Used only as a type: each option's Effect leaves the state requirement
  // open for the menu loop to satisfy.
  type TerminalUserStateConfigContext,
} from "../../../../types.ts";
import type { ProgramError } from "../../../../errors/index.ts";
import { menuGlobals } from "../../../../utils/menu_globals.ts";
import { ChartRendererLive } from "../../../../StocksMenu/services/ChartRenderer.ts";
import { CryptoServiceLive } from "src/services/CryptoService/index.ts";
import { Effect, Layer } from "effect";
import {
  dexBollingerHandler,
  dexFibonacciHandler,
  dexReturnsHandler,
} from "../actions/technicals.ts";

/** DEX model + the shared chart renderer, as provided to every option here. */
const DexTechnicalsLive = Layer.mergeAll(CryptoServiceLive, ChartRendererLive);

export const bbandsOption: MenuOption = {
  name: "bbands",
  command: "bbands [address] [period] [stddev]",
  description: `Bollinger Bands over the token's daily candles.

    address (optional): ERC-20 contract address; falls back to the loaded DEX address.
    period (optional): moving-average window, default 20.
    stddev (optional): envelope width in standard deviations, default 2.`,
  action: (
    addressStr?: string,
    periodStr?: string,
    stddevStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    Effect.gen(function* () {
      return yield* dexBollingerHandler(addressStr, periodStr, stddevStr);
    }).pipe(Effect.provide(DexTechnicalsLive)),
};

export const fibonacciOption: MenuOption = {
  name: "fibonacci",
  command: "fibonacci [address] [lookback]",
  description: `Fibonacci retracement levels over the token's latest swing.

    address (optional): ERC-20 contract address; falls back to the loaded DEX address.
    lookback (optional): swing window in bars, default the whole series.`,
  action: (
    addressStr?: string,
    lookbackStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    Effect.gen(function* () {
      return yield* dexFibonacciHandler(addressStr, lookbackStr);
    }).pipe(Effect.provide(DexTechnicalsLive)),
};

export const returnsOption: MenuOption = {
  name: "returns",
  command: "returns [address]",
  description: `Daily percent returns (each candle against the previous one).

    address (optional): ERC-20 contract address; falls back to the loaded DEX address.`,
  action: (
    addressStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    Effect.gen(function* () {
      return yield* dexReturnsHandler(addressStr);
    }).pipe(Effect.provide(DexTechnicalsLive)),
};

/** The indicator options, in menu order. */
export const technicalsMenuOptions = (
  state: TerminalUserStateConfig,
): MenuOption[] => [bbandsOption, fibonacciOption, returnsOption, ...menuGlobals(state)];
