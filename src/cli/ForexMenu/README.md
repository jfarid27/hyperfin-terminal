# Forex Menu

Foreign exchange rates and charts with a swappable source
([AlphaVantage](https://www.alphavantage.co/) or
[Alpaca](https://docs.alpaca.markets/us/docs/about-market-data-api)).

## Data Sources

The active source is held in `loadedContext.forex.datasource` and chosen with the
`source` command.

| Source | Key (`.env`) | Spot | Chart |
|--------|--------------|------|-------|
| `alphavantage` (default) | `ALPHAVANTAGE_API_KEY` | `CURRENCY_EXCHANGE_RATE` | `FX_DAILY` (full history, narrowed locally) |
| `alpaca` | `ALPACA_API_KEY` + `ALPACA_API_SECRET` | `/v1beta1/forex/latest/rates` | `/v1beta1/forex/rates` (1Day, trailing year) |

- **Spot** is a realtime bid/ask/rate for a pair.
- **Chart** is a daily series narrowed to the requested date range locally.

Alpaca notes:
- Forex market data requires an Alpaca entitlement. Without it the endpoint returns a
  403 (`forbidden: insufficient grants`), surfaced verbatim to the user.
- Alpaca's historical-rates endpoint carries bid/mid/ask only (no OHLC), so the
  chart plots the mid price.

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

- **source** `source [datatypeSource]`
  - Switch the data source: `alphavantage` or `alpaca`.

## Architecture

```
ForexMenu/
├── actions/
│   ├── alphavantage.ts        # forexSpotHandler, forexChartHandler, parsePair
│   ├── alpaca.ts              # forexSpotHandler, forexChartHandler (Alpaca)
│   └── *_test.ts              # Action-level tests (mocked services)
├── services/
│   └── index.ts               # ForexServiceMenuLive layer (ForexService + Alpaca + ChartRenderer)
├── index.ts                   # Menu registration + per-source dispatch
└── README.md
```

`ForexService` itself (schema validation, raw→clean transforms, date-range
resolution) lives in `src/services/ForexService/` alongside the other data
services, with its own `index.test.ts`; the Alpaca service lives in
`src/services/AlpacaService/`.

## Testing

```bash
deno test --allow-all src/cli/ForexMenu/ src/services/ForexService/ src/services/AlpacaService/
```

- **Service tests**: Validate the Effect Schemas against real API response
  fixtures and cover `resolveDateRange` / `filterPointsByRange`.
- **Action tests**: Mock `ForexService`/`AlpacaService`, `ChartRenderer`, and
  `TerminalUserStateConfigContext` — zero network calls, CI-safe.
