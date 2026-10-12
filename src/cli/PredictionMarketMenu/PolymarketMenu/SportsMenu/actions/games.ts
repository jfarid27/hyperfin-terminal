/**
 * @file Sports — league game markets.
 * @description Shared action handler for the sports submenu's per-league games
 * commands (`nfl`, `mlb`, `ufc`, `ncaaf`, `nba`, `ncaam`, `pl`): it shows the
 * current open games for a league as a stack of layered tables — a full-width
 * header (game + resolution date), the moneyline outcomes with their prices,
 * and the specific market's slug.
 *
 * The league is resolved from the Gamma `/sports` endpoint rather than
 * hardcoding tag/series ids: `/sports` lists every league with its `primaryTagId`,
 * its tag ids and the `series` id its game events hang off, so identifying a
 * league's tags is a lookup, not a constant.
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
import { zipEventOutcomePrices } from "../../utils.ts";
import type { PolymarketSport } from "../types.ts";

/**
 * Resolve a league entry (e.g. the NFL) from the `/sports` list by its sport key.
 */
export const findSportLeague = (
  sports: readonly PolymarketSport[],
  sportKey: string,
): PolymarketSport | undefined =>
  sports.find((s) => (s.sport ?? "").toLowerCase() === sportKey.toLowerCase());

/**
 * The head-to-head (moneyline) market for a game event, if present. This is the
 * market whose slug matches the event slug and whose outcome is the winner.
 */
export const gameMoneylineMarket = (event: any): any | undefined =>
  (event?.markets ?? []).find((m: any) => m?.sportsMarketType === "moneyline");

/**
 * True when an event is a head-to-head game rather than a season-long or prop
 * market — i.e. it is open and carries a moneyline market.
 */
export const isGameEvent = (event: any): boolean =>
  Boolean(event?.active) && !event?.closed && gameMoneylineMarket(event) !== undefined;

/**
 * Format an ISO resolution timestamp for display.
 */
export const formatResolutionDate = (iso?: string): string =>
  iso ? iso.replace("T", " ").replace("Z", " UTC") : "N/A";

/** Milliseconds in a day. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** The inclusive resolution-date window a games list is restricted to, in epoch ms. */
export interface ResolutionWindow {
  start: number;
  end: number;
}

/**
 * The `[now - daysPast, now + daysAhead]` resolution window (epoch ms).
 * Defaults cover just-finished games (one day back) and the coming week.
 */
export const resolutionWindow = (
  now: number,
  daysPast: number = 1,
  daysAhead: number = 7,
): ResolutionWindow => ({
  start: now - daysPast * DAY_MS,
  end: now + daysAhead * DAY_MS,
});

/** Format an epoch-millisecond instant for display. */
export const formatEpoch = (ms: number): string =>
  formatResolutionDate(new Date(ms).toISOString());

/** Format an epoch-millisecond instant as an ISO-8601 UTC instant, whole seconds. */
export const isoSeconds = (ms: number): string =>
  new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/**
 * True when the event's resolution (`endDate`) falls inside the window. Events
 * with a missing or unparseable resolution date are excluded.
 */
export const isWithinResolutionWindow = (
  event: any,
  window: ResolutionWindow,
): boolean => {
  const resolvedMs = Date.parse(event?.endDate ?? "");
  return Number.isFinite(resolvedMs) &&
    resolvedMs >= window.start &&
    resolvedMs <= window.end;
};

/**
 * Open head-to-head games whose resolution date falls inside the window.
 */
export const gamesInResolutionWindow = (
  events: readonly any[],
  window: ResolutionWindow,
): any[] =>
  events.filter((event) =>
    isGameEvent(event) && isWithinResolutionWindow(event, window)
  );

/** The three stacked display layers for a single game. */
export interface GameLayers {
  title: string;
  resolutionDate: string;
  outcomes: [string, string][];
  slug: string;
}

/**
 * Build the display layers (header, outcomes, slug) for a game event.
 */
export const buildGameLayers = (event: any): GameLayers => {
  const market = gameMoneylineMarket(event);
  const outcomes = market ? (zipEventOutcomePrices(market) as [string, string][]) : [];
  return {
    title: event?.title ?? market?.question ?? "Unknown game",
    resolutionDate: formatResolutionDate(event?.endDate),
    outcomes,
    slug: market?.slug ?? event?.slug ?? "N/A",
  };
};

/**
 * Render the stacked layers for a single game to the terminal.
 */
export const renderGame = (layers: GameLayers): void => {
  // Full-width header: game title + resolution date.
  terminal.table([
    [`${escapeTableMarkup(layers.title)}   |   Resolves: ${escapeTableMarkup(layers.resolutionDate)}`],
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

  // Outcomes and their price, one row per outcome, split by column.
  terminal.table([
    ["Outcome", "Price"],
    ...layers.outcomes.map(([outcome, price]) => [
      escapeTableMarkup(outcome),
      escapeTableMarkup(price),
    ]),
  ], {
    hasBorder: true,
    contentHasMarkup: true,
    borderChars: "lightRounded",
    borderAttr: { color: "green" },
    textAttr: { bgColor: "default" },
    firstRowTextAttr: { bgColor: "blue" },
    width: 60,
    fit: true,
  });

  // The specific market's slug.
  terminal.table([
    ["Slug"],
    [escapeTableMarkup(layers.slug)],
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
};

/**
 * Builds an action handler that lists the current open games for a league.
 *
 * @param sportKey League key from `/sports`, e.g. `nfl`.
 * @param displayName Name to echo in output; defaults to the league's `/sports`
 *   name. Passed explicitly for leagues whose menu label differs from the API
 *   key (e.g. `ncaaf` resolves `cfb` but should print as `NCAAF`).
 */
export const sportGamesHandler = (sportKey: string, displayName?: string) => (
  limitStr?: string,
): Effect.Effect<
  CommandState,
  ProgramError,
  TerminalUserStateConfigContext | PolymarketModel
> =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;
    const polymarket = yield* PolymarketModel;

    const parsedLimit = Number(limitStr);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;

    const sports = (yield* polymarket.sports.get()) as PolymarketSport[];
    const league = findSportLeague(sports ?? [], sportKey);

    if (!league) {
      console.log(chalk.red(`No "${sportKey}" league found in the Polymarket sports list.`));
      return {
        result: { type: CommandResultType.Success },
        state: st,
      };
    }

    const name = displayName ?? league.name;

    yield* Effect.logDebug(
      `Resolved ${name} -> series ${league.series}, primaryTagId ${league.primaryTagId}, tags ${league.tags}`,
    );

    // Only games resolving in [now - 1 day, now + 7 days]: just-finished games
    // plus the coming week. The window is applied server-side as well, because
    // the events page is ordered by startDate — a series carrying older
    // unresolved games fills that page ahead of the games resolving this week
    // (college football's season opens in August, so its page is all September
    // games without it).
    const window = resolutionWindow(Date.now());
    const events = (yield* polymarket.events.getBySeriesId(league.series, {
      limit,
      resolvesFrom: isoSeconds(window.start),
      resolvesUntil: isoSeconds(window.end),
    })) as any[];

    const games = gamesInResolutionWindow(events ?? [], window);

    yield* Effect.logDebug(
      `${games.length} ${name} games in window (series ${league.series})`,
    );

    console.log(chalk.blue.bold(`Open ${name} games (${games.length})`));
    console.log(
      chalk.blue(
        `Resolution window: ${formatEpoch(window.start)} .. ${formatEpoch(window.end)}`,
      ),
    );

    if (games.length === 0) {
      console.log(chalk.yellow("No games resolve in the window."));
    }

    for (const game of games) {
      renderGame(buildGameLayers(game));
    }

    return {
      result: { type: CommandResultType.Success },
      state: st,
    };
  });
