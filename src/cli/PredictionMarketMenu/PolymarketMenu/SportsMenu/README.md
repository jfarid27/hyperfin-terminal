# Sports Menu (Polymarket)

Submenu of the Polymarket menu for sports markets.

## Commands

- **nfl**
  - Usage: `nfl [limit]`
  - Description: Show NFL games whose resolution date is within the current
    window — from one day ago through the next seven days (just-finished games
    plus the coming week). Each game is printed as a stack of layers: a
    full-width header with the matchup and its resolution date, the moneyline
    outcomes with their prices (one row per outcome, split by column), and the
    specific market's slug.
  - `limit` (optional): number of events to scan, default 20.
  - The slug shown is the game's moneyline market slug (identical to the event
    slug, e.g. `nfl-bal-atl-2026-10-12`) and can be viewed with the Polymarket
    menu's `market <slug>` command.
- **tags**
  - Usage: `tags [term]`
  - Description: List the leagues Polymarket reports from the `/sports`
    endpoint with their tag ids and series id. Use this to identify a league's
    game tags (e.g. the NFL's `primaryTagId` 450 / tags `1,450,100639` /
    `series` 12185) before fetching its games.
  - `term` (optional): filter leagues by sport key or name.

## How the NFL games are found

1. `GET https://gamma-api.polymarket.com/sports` → find the entry whose
   `sport` is `nfl`. It carries `primaryTagId`, `tags` and `series`.
2. `GET https://gamma-api.polymarket.com/events?series_id=<series>&closed=false`
   → the league's events.
3. Keep only events that are open and carry a moneyline market — those are the
   head-to-head games; season/prop events (e.g. `-player-props`,
   `-first-td-scorer`) are filtered out.
4. Keep only games whose `endDate` (resolution date) falls in
   `[now - 1 day, now + 7 days]`, so the list shows just-finished games and the
   coming week. Events are fetched `order=startDate&ascending=true` so the
   nearest games are within the `limit`.
