import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  gameEventMockData,
  propEventMockData,
  sportsMockData,
} from "./constants.ts";
import {
  buildGameLayers,
  DAY_MS,
  findSportLeague,
  formatResolutionDate,
  gameMoneylineMarket,
  gamesInResolutionWindow,
  isGameEvent,
  isWithinResolutionWindow,
  isoSeconds,
  resolutionWindow,
} from "./games.ts";
import { SPORT_LEAGUES } from "../leagues.ts";
import { filterSportsLeagues, sportsLeagueRows } from "./tags.ts";

describe("Polymarket Sports — league catalogue", () => {
  it("maps every league command to a distinct Gamma sport key", () => {
    const keys = SPORT_LEAGUES.map((l) => l.sportKey);
    expect(new Set(keys).size).toBe(SPORT_LEAGUES.length);
  });

  it("resolves the leagues whose key differs from the menu abbreviation", () => {
    const byCommand = new Map(SPORT_LEAGUES.map((l) => [l.command, l.sportKey]));
    expect(byCommand.get("ncaaf")).toBe("cfb");
    expect(byCommand.get("ncaam")).toBe("cbb");
    expect(byCommand.get("pl")).toBe("epl");
  });

  it("resolves the alias keys against the live-shaped /sports list", () => {
    expect(findSportLeague(sportsMockData, "cfb")?.name).toBe("College Football");
    expect(findSportLeague(sportsMockData, "cbb")?.name).toBe("College Basketball");
    expect(findSportLeague(sportsMockData, "epl")?.name).toBe("Premier League");
  });

  it("covers the requested leagues", () => {
    expect(SPORT_LEAGUES.map((l) => l.command)).toEqual([
      "nfl",
      "mlb",
      "ufc",
      "ncaaf",
      "nba",
      "ncaam",
      "pl",
      "nhl",
    ]);
  });
});

describe("Polymarket Sports — league lookup", () => {
  it("resolves the NFL league from the /sports list by sport key", () => {
    const league = findSportLeague(sportsMockData, "nfl");
    expect(league?.primaryTagId).toBe(450);
    expect(league?.series).toBe("12185");
    expect(league?.tags).toBe("1,450,100639");
  });

  it("is case-insensitive on the sport key", () => {
    expect(findSportLeague(sportsMockData, "NFL")?.name).toBe("NFL");
  });

  it("returns undefined for an unknown league", () => {
    expect(findSportLeague(sportsMockData, "mls")).toBe(undefined);
  });
});

describe("Polymarket Sports — game detection", () => {
  it("finds the moneyline market on a game event", () => {
    const moneyline = gameMoneylineMarket(gameEventMockData);
    expect(moneyline?.slug).toBe("nfl-bal-atl-2026-10-12");
    expect(moneyline?.sportsMarketType).toBe("moneyline");
  });

  it("treats an open event with a moneyline market as a game", () => {
    expect(isGameEvent(gameEventMockData)).toBe(true);
  });

  it("rejects prop events with no moneyline market", () => {
    expect(isGameEvent(propEventMockData)).toBe(false);
  });

  it("rejects closed events", () => {
    expect(isGameEvent({ ...gameEventMockData, closed: true })).toBe(false);
  });

  it("rejects inactive events", () => {
    expect(isGameEvent({ ...gameEventMockData, active: false })).toBe(false);
  });
});

describe("Polymarket Sports — game layers", () => {
  const layers = buildGameLayers(gameEventMockData);

  it("uses the event title and resolution date for the header", () => {
    expect(layers.title).toBe("Ravens vs. Falcons");
    expect(layers.resolutionDate).toBe("2026-10-12 00:20:00 UTC");
  });

  it("zips the moneyline outcomes with their prices", () => {
    expect(layers.outcomes).toEqual([
      ["Ravens", "0.55"],
      ["Falcons", "0.45"],
    ]);
  });

  it("exposes the specific market slug (same as the event slug)", () => {
    expect(layers.slug).toBe("nfl-bal-atl-2026-10-12");
  });

  it("formats a missing date as N/A", () => {
    expect(formatResolutionDate(undefined)).toBe("N/A");
  });
});

describe("Polymarket Sports — league rows", () => {
  it("filters leagues by sport key or name", () => {
    expect(filterSportsLeagues(sportsMockData, "nfl").map((s) => s.sport)).toEqual(["nfl"]);
    expect(filterSportsLeagues(sportsMockData, "NBA").map((s) => s.sport)).toEqual(["nba"]);
    expect(filterSportsLeagues(sportsMockData, "zzz")).toEqual([]);
  });

  it("returns every league when no term is given", () => {
    expect(filterSportsLeagues(sportsMockData).length).toBe(8);
  });

  it("maps leagues to Name/Sport/Primary Tag/Tags/Series rows", () => {
    expect(sportsLeagueRows(sportsMockData)[0]).toEqual([
      "NFL",
      "nfl",
      "450",
      "1,450,100639",
      "12185",
    ]);
  });
});

describe("Polymarket Sports — resolution window", () => {
  const now = Date.parse("2026-10-12T04:00:00Z");
  const window = resolutionWindow(now);

  it("spans one day back and seven days ahead", () => {
    expect(window.start).toBe(now - DAY_MS);
    expect(window.end).toBe(now + 7 * DAY_MS);
  });

  it("formats window bounds as whole-second ISO instants for the API", () => {
    expect(isoSeconds(now)).toBe("2026-10-12T04:00:00Z");
    expect(isoSeconds(Date.parse("2026-10-12T00:20:12.088Z"))).toBe("2026-10-12T00:20:12Z");
  });

  it("includes a game that just finished (earlier today)", () => {
    expect(isWithinResolutionWindow({ endDate: "2026-10-12T00:20:00Z" }, window))
      .toBe(true);
  });

  it("includes a game inside the coming week", () => {
    expect(isWithinResolutionWindow({ endDate: "2026-10-18T17:00:00Z" }, window))
      .toBe(true);
  });

  it("excludes a game beyond seven days out", () => {
    expect(isWithinResolutionWindow({ endDate: "2026-10-25T17:00:00Z" }, window))
      .toBe(false);
  });

  it("excludes a game older than the one-day lookback", () => {
    expect(isWithinResolutionWindow({ endDate: "2026-10-05T17:00:00Z" }, window))
      .toBe(false);
  });

  it("excludes events with a missing resolution date", () => {
    expect(isWithinResolutionWindow({}, window)).toBe(false);
  });

  it("keeps only open games inside the window", () => {
    const inWindow = { ...gameEventMockData, endDate: "2026-10-12T00:20:00Z" };
    const tooLate = {
      ...gameEventMockData,
      slug: "nfl-xxx-yyy-2026-10-30",
      endDate: "2026-10-30T00:15:00Z",
    };
    const prop = { ...propEventMockData, endDate: "2026-10-12T00:20:00Z" };

    expect(
      gamesInResolutionWindow([inWindow, tooLate, prop], window).map((e) => e.slug),
    ).toEqual(["nfl-bal-atl-2026-10-12"]);
  });
});
