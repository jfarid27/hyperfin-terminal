# Options Menu

Options chain data with a swappable source ([Yahoo Finance](https://finance.yahoo.com/)
or [Alpaca](https://docs.alpaca.markets/us/docs/about-market-data-api)).

## Data Sources

The active source is held in `loadedContext.options.datasource` and chosen with the
`source` command.

| Source | Key (`.env`) | Notes |
|--------|--------------|-------|
| `yahoofinance` (default) | none | free `v7/finance/options` API with cookie+crumb auth; full greeks + IV |
| `alpaca` | `ALPACA_API_KEY` + `ALPACA_API_SECRET` | `/v1beta1/options/snapshots/{underlying}` (chain + expirations) |

Alpaca options notes:
- The free **indicative** feed carries latest trade/quote and daily bars, but **no
  open interest and no IV/greeks** — those require the paid OPRA feed. The chain
  renders `n/a` for OI/IV when unavailable, and `volcurve` reports that IV is
  unavailable instead of drawing an empty chart.
- There is no "list expirations" endpoint, so the expirations are derived from the
  OCC contract symbols in the (paginated) chain response.

## Commands

- **chain** `chain [symbol] [date]`
  - Fetches the options chain for the given symbol and renders calls/puts in terminal-kit tables.
  - **`date`** (optional): can be a 1-based index (`1` = nearest), a YYYY-MM-DD string (`2026-08-21`), or omitted for the nearest expiration.
  - Falls back to the loaded token symbol if no symbol argument is given.
  - Displays: contract symbol, ITM/OTM, strike, last price, bid, ask, volume, open interest, implied volatility.

- **volcurve** `volcurve [symbol] [type] [date]`
  - Plots the implied-volatility curve across strikes for one expiration (`type` = `call`/`put`, default `call`).
  - With the Alpaca indicative feed, IV is unavailable and the command says so.

- **source** `source [datatypeSource]`
  - Switch the data source: `yahoofinance` or `alpaca`.

## Architecture

```
OptionsMenu/
├── actions/
│   ├── chain.ts                   # chainHandler — Yahoo fetch + display
│   ├── volcurve.ts                # volcurveHandler — Yahoo IV curve
│   └── alpaca.ts                  # chainHandler, volcurveHandler (Alpaca) + resolveExpiration
├── index.ts                       # Menu registration + per-source dispatch
└── README.md
```

Services live in `src/services/OptionsService/` (`YahooFinanceOptionsService` plus the
shared `AlpacaService`) with `OptionsServiceLive` merging them.

## How It Works (Yahoo Finance)

Yahoo Finance requires a cookie+crumb handshake before serving options data:

1. **GET `https://fc.yahoo.com/`** — returns 404 but sets an `A3` cookie
2. **GET `https://query2.finance.yahoo.com/v1/test/getcrumb`** — returns a crumb string
3. **GET `https://query2.finance.yahoo.com/v7/finance/options/{ticker}?crumb={crumb}&date={unix}`** — returns the option chain

The service manages this cookie jar manually (Deno's native `fetch` doesn't persist cookies) and caches the crumb for the session lifetime.

## Testing

```bash
deno test --allow-all src/cli/OptionsMenu/
```
