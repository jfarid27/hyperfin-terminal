# Sports Menu (Polymarket)

Submenu of the Polymarket menu for sports markets.

## Commands

Each league has its own command that lists the league's current open games.
Every command takes the same optional argument:

- **nfl** — `nfl [limit]` — NFL
- **mlb** — `mlb [limit]` — MLB
- **ufc** — `ufc [limit]` — UFC
- **ncaaf** — `ncaaf [limit]` — NCAAF (college football)
- **nba** — `nba [limit]` — NBA
- **ncaam** — `ncaam [limit]` — NCAAM (college basketball)
- **pl** — `pl [limit]` — PL (Premier League football)
- **nhl** — `nhl [limit]` — NHL

Description: show the league's games whose resolution date is within the
current window — from one day ago through the next seven days (just-finished
games plus the coming week). Each game is printed as a stack of layers: a
full-width header with the matchup and its resolution date, the moneyline
outcomes with their prices (one row per outcome, split by column), and the
specific market's slug with a link to its page on polymarket.com.

`limit` (optional): number of events to scan, default 20.

The slug shown is the game's moneyline market slug (identical to the event
slug, e.g. `nfl-bal-atl-2026-10-12`) and can be viewed with the Polymarket
menu's `market <slug>` command.

The link is the canonical URL for that market —
`https://polymarket.com/event/<event-slug>/<market-slug>` — which is where the
site's own `https://polymarket.com/market/<market-slug>` redirects (`buildGameLayers`
in `actions/games.ts` builds it through `links.ts`). A game's market slug equals
its event slug, so the segment repeats; that is the site's canonical form, not a
duplication bug.

- **tags**
  - Usage: `tags [term]`
  - Description: List the leagues Polymarket reports from the `/sports`
    endpoint with their tag ids and series id. Use this to identify a league's
    game tags (e.g. the NFL's `primaryTagId` 450 / tags `1,450,100639` /
    `series` 12185) before fetching its games.
  - `term` (optional): filter leagues by sport key or name.

## Menu label vs. Gamma sport key

The command a league is listed under is the abbreviation users type, which is
not always the league's `sport` key on Gamma `/sports`. The mapping lives in
`leagues.ts` (`SPORT_LEAGUES`) and is applied by the menu, not hardcoded in a
handler:

| Command | Gamma `sport` key | League |
|---|---|---|
| `nfl` | `nfl` | NFL |
| `mlb` | `mlb` | MLB |
| `ufc` | `ufc` | UFC |
| `ncaaf` | `cfb` | College Football |
| `nba` | `nba` | NBA |
| `ncaam` | `cbb` | College Basketball |
| `pl` | `epl` | Premier League |
| `nhl` | `nhl` | NHL |

## How a league's games are found

1. `GET https://gamma-api.polymarket.com/sports` → find the entry whose `sport`
   matches the league's Gamma key. It carries `primaryTagId`, `tags` and
   `series`.
2. `GET https://gamma-api.polymarket.com/events?series_id=<series>&closed=false`
   → the league's events, bounded to the resolution window with
   `end_date_min`/`end_date_max` and ordered `startDate` ascending.
3. Keep only events that are open and carry a moneyline market — those are the
   head-to-head games; season/prop events (e.g. `-player-props`,
   `-first-td-scorer`) are filtered out.
4. Keep only games whose `endDate` (resolution date) falls in
   `[now - 1 day, now + 7 days]`, so the list shows just-finished games and the
   coming week.

**The window must be applied server-side.** The events endpoint pages by
`order=startDate&ascending=true`, but a series can hold older games that never
got marked `closed` — college football's season opens in late August, so its
first page is September fixtures. Without `end_date_min`/`end_date_max` the page
fills with those out-of-window games and a small `limit` returns nothing. The
in-code window filter stays as a guard on the API's filtering.

## Adding a league

Add one entry to `SPORT_LEAGUES` in `leagues.ts` — command token, Gamma sport
key and display title. The menu option, handler wiring and tests follow from it.
