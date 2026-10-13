/**
 * The Ethereum submenu definitions.
 *
 * Three actions — spot, chart, technicals — all parameterized by an ERC-20
 * contract address, all priced from CoinMarketCap's DEX data.
 *
 * Split out of `index.ts` so the option list can be asserted on without booting
 * the terminal runner: importing `index.ts` pulls in
 * `registerTerminalApplication`, which starts an input loop.
 */

import {
  CommandResultType,
  type CommandState,
  type MenuOption,
  type TerminalUserStateConfig,
  TerminalUserStateConfigContext,
} from "../../../types.ts";
import type { ProgramError } from "../../../errors/index.ts";
import { menuGlobals } from "../../../utils/menu_globals.ts";
import { ChartRendererLive } from "../../../StocksMenu/services/ChartRenderer.ts";
import { CryptoServiceLive } from "src/services/CryptoService/index.ts";
import { Effect, Layer } from "effect";
import { dexChartHandler } from "./actions/chart.ts";
import { dexSpotHandler } from "./actions/spot.ts";
import { DEX_INTERVAL_HINT } from "../types.ts";
import { technicalsMenu as ethereumTechnicalsMenu, technicalsTerminal as ethereumTechnicalsTerminal } from "./TechnicalsMenu/index.ts";

/** CoinMarketCap model + the shared chart renderer, for the actions here. */
const EthereumLive = Layer.mergeAll(CryptoServiceLive, ChartRendererLive);

export const spotOption: MenuOption = {
  name: "spot",
  command: "spot [address]",
  description: `Show the current price and the day's activity for an Ethereum token.

    address (optional): ERC-20 contract address; falls back to the loaded DEX address.
    e.g. spot 0x49b5a631f54927c0007232844f06fe18cbf69786`,
  action: (
    addressStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    Effect.gen(function* () {
      return yield* dexSpotHandler(addressStr);
    }).pipe(Effect.provide(EthereumLive)),
};

export const chartOption: MenuOption = {
  name: "chart",
  command: "chart [address] [interval]",
  description: `Chart the token's price from CoinMarketCap candles.

    address (optional): ERC-20 contract address; falls back to the loaded DEX address.
    interval (optional): candle interval, default 1d. One of ${DEX_INTERVAL_HINT}.`,
  action: (
    addressStr?: string,
    intervalStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    Effect.gen(function* () {
      return yield* dexChartHandler(addressStr, intervalStr);
    }).pipe(Effect.provide(EthereumLive)),
};

/**
 * Enter the technicals submenu, which lists one option per indicator
 * (bbands, fibonacci, returns).
 */
export const technicalsOption: MenuOption = {
  name: "technicals",
  command: "technicals",
  description: "Technical analysis indicators: bbands, fibonacci, returns",
  action: () => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const newState = yield* ethereumTechnicalsTerminal(st);
    return {
      result: { type: CommandResultType.Success },
      state: newState,
    };
  }),
  submenu: () => ethereumTechnicalsMenu,
};

/** The Ethereum submenu options, in menu order. */
export const ethereumMenuOptions = (
  state: TerminalUserStateConfig,
): MenuOption[] => [spotOption, chartOption, technicalsOption, ...menuGlobals(state)];
