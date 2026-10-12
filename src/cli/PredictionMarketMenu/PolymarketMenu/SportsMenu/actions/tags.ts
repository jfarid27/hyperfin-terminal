/**
 * @file Sports — league tags.
 * @description Action handler for the sports submenu's `tags` command: lists the
 * leagues Polymarket reports from the Gamma `/sports` endpoint together with the
 * tag ids and series id used to pull their markets. This is the lookup that
 * identifies a league's game tags (e.g. the NFL's `primaryTagId` and `series`)
 * before fetching any games.
 */

import { Effect } from "effect";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import {
  CommandResultType,
  TerminalUserStateConfigContext,
  type CommandState,
} from "../../../../types.ts";
import type { ProgramError } from "../../../../errors/index.ts";
import chalk from "chalk";
import { PolymarketModel } from "../../../../../services/PolymarketService/index.ts";
import { escapeTableMarkup } from "../../../../utils/table_markup.ts";
import type { PolymarketSport } from "../types.ts";

/**
 * Filter league entries by a search term, matching either the sport key or the
 * display name. With no term, every league is returned.
 */
export const filterSportsLeagues = (
  sports: readonly PolymarketSport[],
  term?: string,
): PolymarketSport[] => {
  if (!term) return [...sports];
  const needle = term.toLowerCase();
  return sports.filter((s) =>
    (s.sport ?? "").toLowerCase().includes(needle) ||
    (s.name ?? "").toLowerCase().includes(needle)
  );
};

/**
 * Map league entries to table rows: Name | Sport | Primary Tag | Tags | Series.
 */
export const sportsLeagueRows = (sports: readonly PolymarketSport[]): string[][] =>
  sports.map((s) => [
    escapeTableMarkup(s.name ?? ""),
    escapeTableMarkup(s.sport ?? ""),
    escapeTableMarkup(String(s.primaryTagId ?? "")),
    escapeTableMarkup(s.tags ?? ""),
    escapeTableMarkup(s.series ?? ""),
  ]);

/**
 * Lists the Polymarket sports leagues with their tag and series ids.
 */
export const sportsTagsHandler = (
  term?: string,
): Effect.Effect<
  CommandState,
  ProgramError,
  TerminalUserStateConfigContext | PolymarketModel
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const polymarket = yield* PolymarketModel;

    const sports = (yield* polymarket.sports.get()) as PolymarketSport[];
    const leagues = filterSportsLeagues(sports ?? [], term);

    yield* Effect.logDebug(`${leagues.length} leagues matched`);

    console.log(chalk.blue.bold(`Polymarket leagues (${leagues.length})`));

    terminal.table([
      ["Name", "Sport", "Primary Tag", "Tags", "Series"],
      ...sportsLeagueRows(leagues),
    ], {
      hasBorder: true,
      contentHasMarkup: true,
      borderChars: "lightRounded",
      borderAttr: { color: "green" },
      textAttr: { bgColor: "default" },
      firstRowTextAttr: { bgColor: "green" },
      width: 120,
      fit: true,
    });

    return {
      result: { type: CommandResultType.Success },
      state: st,
    };
  });
