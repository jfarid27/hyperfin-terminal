# Stocks Menu

Real-time stock data powered by [AlphaVantage](https://www.alphavantage.co/).

## Data Source

All data comes from AlphaVantage's free tier APIs. Requires `ALPHAVANTAGE_API_KEY` set in `.env`.

## Commands

- **spot** `spot [symbol]`
  - Fetches the latest quote: price, change, open, high, low, previous close, volume.
  - Falls back to the loaded token symbol if no argument is given.

- **chart** `chart [symbol]`
  - Fetches the daily time series (compact, ~100 data points) and renders a line chart.
  - Falls back to the loaded token symbol if no argument is given.

## Architecture

```
StocksMenu/
├── actions/
│   ├── alphavantage.ts          # spotPriceHandler, chartPriceHandler
│   └── alphavantage_test.ts     # Action-level tests (mocked services)
├── services/
│   ├── AlphaVantageService.ts   # Effect Schema validation, raw→clean transforms
│   ├── AlphaVantageService_test.ts  # Schema + transform unit tests
│   ├── ChartRenderer.ts         # Injectable chart rendering (Effect service)
│   ├── index.ts                 # StocksServiceLive layer
├── types.ts                     # StockSymbolType
├── index.ts                     # Menu registration, wires handlers to StocksServiceLive
└── README.md
```

## Testing

```bash
deno test --allow-env --allow-read --allow-net --allow-sys --allow-run cli/StocksMenu/
```

- **Service tests**: Validate Effect Schemas against real API response fixtures and test `catchTag(ParseError → HTTPError)`.
- **Action tests**: Mock `AlphaVantageService`, `ChartRenderer`, and `TerminalUserStateConfigContext` — zero network calls, CI-safe.
