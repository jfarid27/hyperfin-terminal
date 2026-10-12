/**
 * Mock data for the Polymarket sports submenu tests.
 */

import type { PolymarketSport } from "../types.ts";

/**
 * Mock `/sports` response — the leagues the sports submenu supports.
 *
 * Ids/tags/series mirror the live Gamma `/sports` payload, including the keys
 * that differ from their menu abbreviation (`cfb`, `cbb`, `epl`).
 */
export const sportsMockData: PolymarketSport[] = [
  {
    id: 10,
    sport: "nfl",
    name: "NFL",
    primaryTagId: 450,
    tags: "1,450,100639",
    series: "12185",
  },
  {
    id: 8,
    sport: "mlb",
    name: "MLB",
    primaryTagId: 100381,
    tags: "1,100381,100639",
    series: "3",
  },
  {
    id: 48,
    sport: "ufc",
    name: "UFC",
    primaryTagId: 279,
    tags: "1,279,100639",
    series: "38",
  },
  {
    id: 9,
    sport: "cfb",
    name: "College Football",
    primaryTagId: 100351,
    tags: "1,100351,100639",
    series: "12756",
  },
  {
    id: 34,
    sport: "nba",
    name: "NBA",
    primaryTagId: 745,
    tags: "1,745,100639",
    series: "10345",
  },
  {
    id: 4,
    sport: "cbb",
    name: "College Basketball",
    primaryTagId: 101178,
    tags: "1,101178,100639",
    series: "10470",
  },
  {
    id: 2,
    sport: "epl",
    name: "Premier League",
    primaryTagId: 306,
    tags: "1,306,100639",
    series: "10188",
  },
  {
    id: 35,
    sport: "nhl",
    name: "NHL",
    primaryTagId: 899,
    tags: "1,899,100639",
    series: "10346",
  },
];

/** A head-to-head NFL game event with a moneyline market. */
export const gameEventMockData = {
  id: "941348",
  slug: "nfl-bal-atl-2026-10-12",
  title: "Ravens vs. Falcons",
  active: true,
  closed: false,
  endDate: "2026-10-12T00:20:00Z",
  markets: [
    {
      slug: "nfl-bal-atl-2026-10-12",
      question: "Ravens vs. Falcons",
      sportsMarketType: "moneyline",
      outcomes: '["Ravens", "Falcons"]',
      outcomePrices: '["0.55", "0.45"]',
    },
    {
      slug: "nfl-bal-atl-2026-10-12-spread-away-1pt5",
      question: "Spread: Ravens (-1.5)",
      sportsMarketType: "spreads",
      outcomes: '["Ravens", "Falcons"]',
      outcomePrices: '["0.5", "0.5"]',
    },
  ],
};

/** A prop event for the same game — no moneyline market, so not a game. */
export const propEventMockData = {
  id: "941400",
  slug: "nfl-bal-atl-2026-10-12-first-td-scorer",
  title: "Ravens vs. Falcons - First Touchdown Scorer",
  active: true,
  closed: false,
  endDate: "2026-10-12T00:20:00Z",
  markets: [
    {
      slug: "will-x-score-a-touchdown",
      question: "Will X score a touchdown?",
      sportsMarketType: "player_prop",
      outcomes: '["Yes", "No"]',
      outcomePrices: '["0.1", "0.9"]',
    },
  ],
};
