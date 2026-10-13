/**
 * The DEX submenu definitions.
 *
 * `dex` is the on-chain half of the crypto menu: tokens are identified by
 * contract address rather than by ticker. The chain is a submenu of its own so
 * a second chain is one more option here, not a second code path.
 *
 * Split out of `index.ts` so the option list can be asserted on without booting
 * the terminal runner: importing `index.ts` pulls in
 * `registerTerminalApplication`, which starts an input loop.
 */

import {
  CommandResultType,
  type MenuOption,
  type TerminalUserStateConfig,
  TerminalUserStateConfigContext,
} from "../../types.ts";
import { menuGlobals } from "../../utils/menu_globals.ts";
import { Effect } from "effect";
import { ethereumMenu, ethereumTerminal } from "./EthereumMenu/index.ts";

/**
 * Enter the Ethereum submenu, which prices ERC-20 tokens by contract address.
 */
export const ethereumOption: MenuOption = {
  name: "ethereum",
  command: "ethereum",
  description: "Enter the Ethereum submenu (spot, chart and technicals by contract address).",
  action: () => Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const newState = yield* ethereumTerminal(st);
    return {
      result: { type: CommandResultType.Success },
      state: newState,
    };
  }),
  submenu: () => ethereumMenu,
};

/** The DEX submenu options, in menu order. */
export const dexMenuOptions = (
  state: TerminalUserStateConfig,
): MenuOption[] => [ethereumOption, ...menuGlobals(state)];
