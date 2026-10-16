/**
 * @file Polymarket — canonical web links.
 * @description Every Gamma/CLOB identifier a handler prints (an event `slug`, a
 * market `slug`) has a page on polymarket.com, and the reader wants to reach it.
 * The builders here turn those ids into the URL the site itself uses, so a
 * command's output can carry a link instead of a bare slug.
 *
 * Verified against the live site (2026-10-16) — `https://polymarket.com/market/<market>`
 * 307-redirects to exactly `https://polymarket.com/event/<event>/<market>`, and an
 * unknown market slug redirects to `/404` instead. So the two-segment event URL is
 * the canonical link for a market, and `/market/<slug>` is the resolver that finds
 * the event slug for us when the API response does not name it.
 *
 * The same market slug and event slug for a head-to-head sports game (the
 * moneyline market carries the event's slug) is expected, not a bug: the site's
 * canonical URL for it repeats the segment
 * (`/event/nfl-sea-den-2026-10-16/nfl-sea-den-2026-10-16`).
 */

import { outputWidth, wrapText } from "../../utils/text.ts";

/** The web origin. Not the API host — Gamma is `gamma-api.polymarket.com`. */
export const POLYMARKET_WEB_ORIGIN = "https://polymarket.com";

/**
 * The event a market belongs to, as Gamma names it on the market object
 * (`events: [{ slug }]`).
 *
 * Present on markets fetched by tag, by liquidity, by slug and in the data-api
 * positions feed; absent only if the response was projected without it, which is
 * why `polymarketMarketUrl` can build a link without it.
 */
export const eventSlugOf = (market: unknown): string | undefined => {
  const events = (market as { events?: unknown })?.events;
  if (!Array.isArray(events) || events.length === 0) return undefined;
  const slug = (events[0] as { slug?: unknown })?.slug;
  return typeof slug === "string" && slug.length > 0 ? slug : undefined;
};

/**
 * The event's page: `https://polymarket.com/event/<eventSlug>`.
 *
 * Empty string for a missing slug, so a caller can print the value blindly and
 * get a blank cell rather than a link to `/event/undefined`.
 */
export const polymarketEventUrl = (eventSlug?: string | null): string =>
  eventSlug ? `${POLYMARKET_WEB_ORIGIN}/event/${eventSlug}` : "";

/**
 * The canonical page for a market.
 *
 * With the event slug: `https://polymarket.com/event/<eventSlug>/<marketSlug>`,
 * which is where the site's own `/market/<marketSlug>` link redirects. Without
 * it: `https://polymarket.com/market/<marketSlug>`, which is a valid, resolving
 * link in its own right — it just costs the reader one redirect.
 */
export const polymarketMarketUrl = (
  marketSlug?: string | null,
  eventSlug?: string | null,
): string =>
  marketSlug
    ? eventSlug
      ? `${POLYMARKET_WEB_ORIGIN}/event/${eventSlug}/${marketSlug}`
      : `${POLYMARKET_WEB_ORIGIN}/market/${marketSlug}`
    : "";

/** The canonical link for a raw Gamma market object. */
export const marketUrlOf = (market: unknown): string =>
  polymarketMarketUrl(
    (market as { slug?: string })?.slug,
    eventSlugOf(market),
  );

/**
 * The `Link: <url>` line(s) for a market or event view, wrapped to `width`
 * columns (`outputWidth()` by default; empty for a missing URL, so a caller can
 * print the lines blindly).
 *
 * A wrapped line of the shell's log is **truncated** at the pane edge, not
 * wrapped, so a long URL printed whole loses its tail and the link stops
 * resolving. The URL is wrapped against the room left by the label and the
 * label is prefixed to the first line — going through `wrapText` on the whole
 * `Link: <url>` string would break *after* the label (a URL is one long word,
 * so it never fits beside it) and leave a bare `Link:` line above the URL.
 */
export const linkLines = (url: string, width: number = outputWidth()): string[] => {
  if (!url) return [];
  const label = "Link: ";
  const [first, ...rest] = wrapText(url, Math.max(1, width - label.length));
  return [`${label}${first}`, ...rest];
};
