import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { leagueOptions, sportsMenuOptions, tagsOption } from "./menu.ts";
import { SPORT_LEAGUES } from "./leagues.ts";

describe("Polymarket Sports submenu options", () => {
  const options = sportsMenuOptions({} as never);
  const names = options.map((o) => o.name);

  it("exposes a games command per supported league, with an optional limit", () => {
    expect(leagueOptions.map((o) => o.command)).toEqual([
      "nfl [limit]",
      "mlb [limit]",
      "ufc [limit]",
      "ncaaf [limit]",
      "nba [limit]",
      "ncaam [limit]",
      "pl [limit]",
      "nhl [limit]",
    ]);
    expect(names).toEqual(expect.arrayContaining([
      "NFL",
      "MLB",
      "UFC",
      "NCAAF",
      "NBA",
      "NCAAM",
      "PL",
      "NHL",
    ]));
  });

  it("names each league option after its abbreviation", () => {
    for (const league of SPORT_LEAGUES) {
      const option = leagueOptions.find((o) => o.command === `${league.command} [limit]`);
      expect(option?.name).toBe(league.command.toUpperCase());
      expect(option?.description).toContain(league.title);
    }
  });

  it("exposes a tags command with an optional term", () => {
    expect(tagsOption.name).toBe("tags");
    expect(tagsOption.command).toBe("tags [term]");
    expect(names).toContain("tags");
  });

  it("keeps the global menu options", () => {
    expect(names).toContain("back");
    expect(names).toContain("exit");
  });
});
