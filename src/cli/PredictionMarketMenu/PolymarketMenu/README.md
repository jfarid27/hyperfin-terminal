# Polymarket Menu

Polymarket Menu.

Every command that names a market or an event also prints a **clickable link to
its page on polymarket.com**, so a slug in the output is one step from the
source. The links are canonical — `https://polymarket.com/event/<event-slug>`
for an event, `https://polymarket.com/event/<event-slug>/<market-slug>` for a
market (verified against the site's own `/market/<market-slug>` redirect). The
builders live in `links.ts`; the terminal escape that makes a link clickable
(OSC 8) lives in `src/cli/utils/links.ts`.

## Commands

- **top**
  - Usage: `top [limit] [term]`
  - Description: Fetch the top polymarket markets. If a limit is not provided, the top 10 markets by volume are returned. If a term is provided, filters the top markets for that term. Each row carries the market's link.
- **sports**
  - Usage: `sports`
  - Description: Enter the sports submenu. Shows current open league games (NFL, MLB, UFC, NCAAF, NBA, NCAAM, PL, NHL) and the league tags used to find them. See `SportsMenu/README.md`.
- **event**
  - Usage: `event [slug]`
  - Description: Fetch a specific event by slug. Prints the event's link, then each market's link with its outcomes.
- **portfolio analysis**
  - Usage: `portfolio [type] [filename].csv`
  - Description: Give spot or chart analysis of a portfolio of polymarket positions.
        type: spot | chart
        filename: filename of CSV portfolio file inside the top level './portfolios' directory
        See the readme in the './portfolios' directory for more information.
- **market**
  - Usage: `market <slug> [type]`
  - Description: Fetch a specific market by slug. Prints the market's link.
        type (optional): spot | chart
            - spot (default): show current market details
            - chart: show historical price chart for the market
- **markets**
  - Usage: `markets [tag]`
  - Description: Fetch markets for the given tag (default: all). Each row carries the market's link.
- **search**
  - Usage: `search [symbol]`
  - Description: Fetch available event and market tags useful for filtering. Each event and market row carries its link.
- **user positions**
  - Usage: `user [address]`
  - Description: Fetch user positions for the given address. Each position carries the market's link.
- **load**
  - Usage: `load`
  - Description: Fetch available event and market tags useful for filtering.
