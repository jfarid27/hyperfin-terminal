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

- **technicals** `technicals [technicalType] [symbol] [arg1] [arg2]`
  - Charts a technical indicator over the price series.
    - `bbands` — Bollinger Bands. `arg1` = period (default 20), `arg2` = standard deviations (default 2).
    - `fibonacci` — Fibonacci retracement levels over the latest swing. `arg1` = swing lookback in bars (default: the whole series).
  - `symbol` is optional and falls back to the loaded token, e.g. `technicals bbands NVDA 20 2`.
  - Branches on the active `source`: AlphaVantage uses its daily time series, Massive uses `/v2/aggs` daily bars (a year of history).

- **search** `search [term...]`
  - Searches AlphaVantage (`SYMBOL_SEARCH`) for tickers matching a free-text term and prints a table of the matching symbols with their name, instrument type, exchange region, currency, and match score.
  - Accepts multi-word terms (e.g. `search tencent holdings`).
  - Search is a symbol-discovery tool offered only by AlphaVantage, so it does not branch on the active `source`.

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
