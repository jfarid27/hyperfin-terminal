# Government Menu

Government economic data and statistics.

## Commands

- **fred**
  - Usage: `fred [seriesId] [startDate] [endDate]`
  - Description: Fetch and chart FRED economic data series (dates in YYYY-MM-DD format)

- **fredsearch**
  - Usage: `fredsearch [term...]`
  - Description: Search FRED for series by term. Returns a table of matching series IDs with their title, frequency, units, and a description snippet. Multi-word terms are supported (e.g. `fredsearch treasury yield`).
  - The returned series IDs feed straight into `fred` to chart them.

Requires `FRED_API_KEY` set in `.env` (or via `keys fred <api_key>`).
