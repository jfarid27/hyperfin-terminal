/**
 * @file Sports — league catalogue.
 * @description The league table the sports submenu is built from: every entry
 * maps a menu command to the Gamma `/sports` `sport` key that resolves it.
 *
 * The two are kept separate rather than assumed equal, because Gamma's keys are
 * not always the abbreviation a league is known by — college football is `cfb`,
 * college basketball is `cbb` and the Premier League is `epl`, while the menu
 * commands are `ncaaf`, `ncaam` and `pl`.
 */

/** A league the sports submenu can list games for. */
export interface SportLeague {
  /** Menu command token, e.g. `ncaaf`. */
  command: string;
  /** The league's `sport` key on Gamma `/sports`, e.g. `cfb`. */
  sportKey: string;
  /** Human-readable league name used in output and descriptions. */
  title: string;
}

/** The leagues the sports submenu lists, in menu order. */
export const SPORT_LEAGUES: readonly SportLeague[] = [
  { command: "nfl", sportKey: "nfl", title: "NFL" },
  { command: "mlb", sportKey: "mlb", title: "MLB" },
  { command: "ufc", sportKey: "ufc", title: "UFC" },
  { command: "ncaaf", sportKey: "cfb", title: "NCAAF (college football)" },
  { command: "nba", sportKey: "nba", title: "NBA" },
  { command: "ncaam", sportKey: "cbb", title: "NCAAM (college basketball)" },
  { command: "pl", sportKey: "epl", title: "PL (Premier League football)" },
  { command: "nhl", sportKey: "nhl", title: "NHL" },
];
