# Stocks Menu

Real-time stock data with a swappable data source
([AlphaVantage](https://www.alphavantage.co/), [Massive](https://massive.com/), or
[Alpaca](https://docs.alpaca.markets/us/docs/about-market-data-api)).

## Data Sources

The active source is held in `loadedContext.stocks.datasource` and chosen with the
`source` command.

| Source | Key (`.env`) | Spot | Chart | Notes |
|--------|--------------|------|-------|-------|
| `alphavantage` (default) | `ALPHAVANTAGE_API_KEY` | `GLOBAL_QUOTE` | `TIME_SERIES_DAILY` (compact, ~100 pts) | symbol search available |
| `massive` | `MASSIVE_API_KEY` | `/v2/aggs` daily bars | — | spot only |
| `alpaca` | `ALPACA_API_KEY` + `ALPACA_API_SECRET` | snapshot (IEX feed) | `/v2/stocks/{symbol}/bars` (1Day, trailing year) | see below |

Alpaca auth is a key/secret header pair, not a single API key, and the free plan
serves the IEX feed. Missing credentials fail with a `ConfigError`; an account
without the right entitlement fails with Alpaca's own 403 message.

## Commands

- **spot** `spot [symbol]`
  - Fetches the latest quote: price, change, open, high, low, previous close, volume.
  - Falls back to the loaded token symbol if no argument is given.

- **chart** `chart [symbol]`
  - Renders a daily-close line chart (AlphaVantage compact series, or a trailing
    year of daily bars for Alpaca).
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

- **source** `source [datatypeSource]`
  - Switches the active source: `alphavantage`, `massive`, or `alpaca`.

## Architecture

```
StocksMenu/
├── actions/
│   ├── alphavantage.ts          # spotPriceHandler, chartPriceHandler
│   ├── Massive.ts               # spotPriceHandler (Massive)
│   ├── alpaca.ts                # spotPriceHandler, chartPriceHandler (Alpaca)
│   └── *_test.ts                # Action-level tests (mocked services)
├── services/
│   ├── ChartRenderer.ts         # Injectable chart rendering (Effect service)
│   └── index.ts                 # StocksServiceLive layer (AV + Massive + Alpaca + renderer)
├── types.ts                     # StocksDataSourceTypeSchema, StockSymbolType
├── index.ts                     # Menu registration + per-source dispatch
└── README.md
```

The Alpaca data service itself lives in `src/services/AlpacaService/` alongside the
other data services, with its own `index.test.ts`.

## Testing

```bash
deno test --allow-all src/cli/StocksMenu/ src/services/AlpacaService/
```

- **Service tests**: Validate Effect Schemas against real API response fixtures and test `catchTag(ParseError → HTTPError)`.
- **Action tests**: Mock `AlphaVantageService`/`AlpacaService`, `ChartRenderer`, and `TerminalUserStateConfigContext` — zero network calls, CI-safe.
