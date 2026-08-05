# Polymarket Menu

Polymarket Menu.

## Commands

- **top**
  - Usage: `top [limit] [term]`
  - Description: Fetch the top polymarket markets. If a limit is not provided, the top 10 markets by volume are returned. If a term is provided, filters the top markets for that term.
- **event**
  - Usage: `event [slug]`
  - Description: Fetch a specific event by slug.
- **portfolio analysis**
  - Usage: `portfolio [type] [filename].csv`
  - Description: Give spot or chart analysis of a portfolio of polymarket positions.
        type: spot | chart
        filename: filename of CSV portfolio file inside the top level './portfolios' directory
        See the readme in the './portfolios' directory for more information.
- **market**
  - Usage: `market <slug> [type]`
  - Description: Fetch a specific market by slug.
        type (optional): spot | chart
            - spot (default): show current market details
            - chart: show historical price chart for the market
- **markets**
  - Usage: `markets [tag]`
  - Description: Fetch markets for the given tag (default: all)
- **search**
  - Usage: `search [symbol]`
  - Description: Fetch available event and market tags useful for filtering.
- **user positions**
  - Usage: `user [address]`
  - Description: Fetch user positions for the given address.
- **load**
  - Usage: `load`
  - Description: Fetch available event and market tags useful for filtering.
