import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  eventSlugOf,
  linkLines,
  marketUrlOf,
  polymarketEventUrl,
  polymarketMarketUrl,
} from "./links.ts";

/**
 * A live example, verified against the site: `https://polymarket.com/market/<slug>`
 * redirects to exactly this URL, and an unknown market slug redirects to `/404`.
 */
const SPORTS_MARKET = "nfl-sea-den-2026-10-16";

describe("polymarket links — event pages", () => {
  it("builds the event page from its slug", () => {
    expect(polymarketEventUrl(SPORTS_MARKET)).toBe(
      "https://polymarket.com/event/nfl-sea-den-2026-10-16",
    );
  });

  it("returns an empty string for a missing slug, not a broken link", () => {
    expect(polymarketEventUrl(undefined)).toBe("");
    expect(polymarketEventUrl(null)).toBe("");
    expect(polymarketEventUrl("")).toBe("");
  });
});

describe("polymarket links — market pages", () => {
  it("builds the canonical /event/<event>/<market> page when both slugs are known", () => {
    expect(polymarketMarketUrl("will-the-cardinals-win", "pro-football-2027-champion")).toBe(
      "https://polymarket.com/event/pro-football-2027-champion/will-the-cardinals-win",
    );
  });

  it("repeats the segment for a game, whose market slug is the event slug", () => {
    // The site's own canonical URL does this for a head-to-head game — it is
    // not a duplication bug in the builder.
    expect(polymarketMarketUrl(SPORTS_MARKET, SPORTS_MARKET)).toBe(
      "https://polymarket.com/event/nfl-sea-den-2026-10-16/nfl-sea-den-2026-10-16",
    );
  });

  it("falls back to the /market resolver, which redirects to the page", () => {
    expect(polymarketMarketUrl("some-market")).toBe(
      "https://polymarket.com/market/some-market",
    );
  });

  it("returns an empty string for a missing market slug", () => {
    expect(polymarketMarketUrl(undefined, "an-event")).toBe("");
    expect(polymarketMarketUrl("", "an-event")).toBe("");
  });
});

describe("polymarket links — reading slugs off a response", () => {
  it("reads the event slug Gamma puts on a market", () => {
    expect(eventSlugOf({ events: [{ slug: "pro-football-2027-champion" }] })).toBe(
      "pro-football-2027-champion",
    );
  });

  it("is undefined for a missing, empty or malformed events array", () => {
    expect(eventSlugOf({})).toBe(undefined);
    expect(eventSlugOf({ events: [] })).toBe(undefined);
    expect(eventSlugOf({ events: [{}] })).toBe(undefined);
    expect(eventSlugOf({ events: [{ slug: "" }] })).toBe(undefined);
    expect(eventSlugOf(null)).toBe(undefined);
  });

  it("builds the canonical link for a raw market object", () => {
    expect(marketUrlOf({ slug: "m", events: [{ slug: "e" }] })).toBe(
      "https://polymarket.com/event/e/m",
    );
  });

  it("still builds a resolving link for a market with no events array", () => {
    // `/markets` is projected with `events`; a shape that lacks it still gets a
    // link that resolves, just through one redirect.
    expect(marketUrlOf({ slug: "m" })).toBe("https://polymarket.com/market/m");
  });
});

describe("polymarket links — the Link line", () => {
  it("labels the url so the output says what the link is", () => {
    expect(linkLines("https://polymarket.com/event/e", 120)[0]).toBe(
      "Link: https://polymarket.com/event/e",
    );
  });

  it("wraps a url too long for the pane instead of letting the log truncate it", () => {
    // The shell's log truncates at the pane edge, so an over-long url printed
    // whole would lose its tail and stop resolving. Every character survives
    // the wrap, and the first line still starts with the label and the scheme.
    const url = polymarketMarketUrl(
      "will-the-arizona-cardinals-win-the-2027-nfl-league-championship",
      "pro-football-2027-champion-20260729185915366",
    );

    expect(url.length).toBeGreaterThan(80);
    const lines = linkLines(url, 80);

    expect(lines.length > 1).toBe(true);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(80);
    expect(lines.join("").replace(/\s+/g, "")).toBe(
      `Link: ${url}`.replace(/\s+/g, ""),
    );
    expect(lines[0].startsWith("Link: https://")).toBe(true);
  });

  it("returns nothing for an empty url", () => {
    expect(linkLines("")).toEqual([]);
  });
});
