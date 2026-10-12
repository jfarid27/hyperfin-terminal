/**
 * The sports submenu definitions.
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
} from "../../../types.ts";
import type { ProgramError } from "../../../errors/index.ts";
import { menuGlobals } from "../../../utils/menu_globals.ts";
import { PolymarketServiceLive } from "../../../../services/PolymarketService/service.ts";
import { Effect } from "effect";
import { sportGamesHandler } from "./actions/nfl.ts";
import { sportsTagsHandler } from "./actions/tags.ts";

export const nflOption: MenuOption = {
  name: "nfl",
  command: "nfl [limit]",
  description: `Show NFL games resolving within the current window.

    Only games whose resolution date falls from one day ago through the next
    seven days are shown — just-finished games plus the coming week.
    Each game is displayed as a header (matchup + resolution date), the
    moneyline outcomes with their prices, and the market's slug.
    limit (optional): number of events to scan, default 20.`,
  action: (
    limitStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    sportGamesHandler("nfl")(limitStr).pipe(Effect.provide(PolymarketServiceLive)),
};

export const tagsOption: MenuOption = {
  name: "tags",
  command: "tags [term]",
  description: `List Polymarket sports leagues with their tag and series ids.

    Use this to identify a league's game tags (e.g. the NFL's primary tag id
    and series id) before fetching its games.
    term (optional): filter leagues by sport key or name.`,
  action: (
    term?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    sportsTagsHandler(term).pipe(Effect.provide(PolymarketServiceLive)),
};

/** The sports submenu options, in menu order. */
export const sportsMenuOptions = (
  state: TerminalUserStateConfig,
): MenuOption[] => [nflOption, tagsOption, ...menuGlobals(state)];
