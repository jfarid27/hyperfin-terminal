# Forex Menu

Foreign exchange rates and charts powered by [AlphaVantage](https://www.alphavantage.co/).

## Data Source

All data comes from AlphaVantage's free tier forex APIs. Requires
`ALPHAVANTAGE_API_KEY` set in `.env` (or via `keys alphavantage <api_key>`).

- **Spot** uses [`CURRENCY_EXCHANGE_RATE`](https://www.alphavantage.co/documentation/#currency-exchange) — realtime bid/ask/rate for a pair.
- **Chart** uses [`FX_DAILY`](https://www.alphavantage.co/documentation/#fx-daily) — daily OHLC history, fetched with `outputsize=full` and narrowed to the requested range locally.

## Commands

- **spot** `spot <from> <to>`
  - Fetches the latest exchange rate for the currency pair, e.g. `spot EUR USD`.
  - Currencies are 3-letter ISO 4217 codes (case-insensitive) and must differ.
  - Prints the rate, bid, and ask with the refresh timestamp.

- **chart** `chart <from> <to> [fromDate] [toDate]`
  - Charts the daily close for the currency pair, e.g. `chart EUR USD`.
  - `fromDate` / `toDate` are optional and use `YYYY-MM-DD`:
    1. neither given → the trailing **1 year**
    2. `fromDate` only → `fromDate` through **today**
    3. both given → exactly `fromDate` through `toDate` (inclusive)
  - The chart title labels the pair and the resolved range, e.g.
    `EUR/USD FX - 2025-10-07 to 2026-10-07`.

## Architecture

```
ForexMenu/
├── actions/
│   ├── alphavantage.ts        # forexSpotHandler, forexChartHandler, parsePair
│   └── alphavantage_test.ts   # Action-level tests (mocked services)
├── services/
│   └── index.ts               # ForexServiceMenuLive layer (ForexService + ChartRenderer)
├── index.ts                   # Menu registration
└── README.md
```

`ForexService` itself (schema validation, raw→clean transforms, date-range
resolution) lives in `src/services/ForexService/` alongside the other data
services, with its own `index.test.ts`.

## Testing

```bash
deno test --allow-env --allow-read --allow-net --allow-sys src/cli/ForexMenu/ src/services/ForexService/
```

- **Service tests**: Validate the Effect Schemas against real API response
  fixtures and cover `resolveDateRange` / `filterPointsByRange`.
- **Action tests**: Mock `ForexService`, `ChartRenderer`, and
  `TerminalUserStateConfigContext` — zero network calls, CI-safe.
