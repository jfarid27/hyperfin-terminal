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
import { sportGamesHandler } from "./actions/games.ts";
import { sportsTagsHandler } from "./actions/tags.ts";
import { SPORT_LEAGUES, type SportLeague } from "./leagues.ts";

/**
 * The description shared by every league's games command, specialised with the
 * league's name.
 */
const gamesDescription = (league: SportLeague): string =>
  `Show ${league.title} games resolving within the current window.

    Only games whose resolution date falls from one day ago through the next
    seven days are shown — just-finished games plus the coming week.
    Each game is displayed as a header (matchup + resolution date), the
    moneyline outcomes with their prices, and the market's slug.
    limit (optional): number of events to scan, default 20.`;

/**
 * One games command for a league: the menu shows the command's abbreviation as
 * its name, and the handler resolves the league's Gamma `sport` key.
 */
export const leagueOption = (league: SportLeague): MenuOption => ({
  name: league.command.toUpperCase(),
  command: `${league.command} [limit]`,
  description: gamesDescription(league),
  action: (
    limitStr?: string,
  ): Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext> =>
    sportGamesHandler(league.sportKey, league.title)(limitStr).pipe(
      Effect.provide(PolymarketServiceLive),
    ),
});

/** A games command per supported league, in menu order. */
export const leagueOptions: MenuOption[] = SPORT_LEAGUES.map(leagueOption);

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
): MenuOption[] => [...leagueOptions, tagsOption, ...menuGlobals(state)];
