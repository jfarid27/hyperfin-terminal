# Options Menu

Options chain data powered by [Yahoo Finance](https://finance.yahoo.com/).

## Data Source

All data comes from Yahoo Finance's free `v7/finance/options` API. No API key required — the service handles the cookie+crumb authentication dance automatically.

## Commands

- **chain** `chain [symbol] [date]`
  - Fetches the options chain for the given symbol and renders calls/puts in terminal-kit tables.
  - **`date`** (optional): can be a 1-based index (`1` = nearest), a YYYY-MM-DD string (`2026-08-21`), or omitted for the nearest expiration.
  - Falls back to the loaded token symbol if no symbol argument is given.
  - Displays: contract symbol, ITM/OTM, strike, last price, bid, ask, volume, open interest, implied volatility.

- **source** `source [datatypeSource]`
  - Switch the data source (currently only `yahoofinance`).

## Architecture

```
OptionsMenu/
├── actions/
│   └── chain.ts                   # chainHandler — fetch + display
├── services/
│   ├── YahooFinanceOptionsService.ts  # Cookie+crumb auth, Effect Schema validation
│   └── index.ts                   # OptionsServiceLive layer
├── types.ts                       # OptionSymbolType, OptionContract, OptionsChain
├── index.ts                       # Menu registration, wires handlers to OptionsServiceLive
└── README.md
```

## How It Works

Yahoo Finance requires a cookie+crumb handshake before serving options data:

1. **GET `https://fc.yahoo.com/`** — returns 404 but sets an `A3` cookie
2. **GET `https://query2.finance.yahoo.com/v1/test/getcrumb`** — returns a crumb string
3. **GET `https://query2.finance.yahoo.com/v7/finance/options/{ticker}?crumb={crumb}&date={unix}`** — returns the option chain

The service manages this cookie jar manually (Deno's native `fetch` doesn't persist cookies) and caches the crumb for the session lifetime.

Response validation uses **Effect Schema** — `OptionChainResponseRaw` → `OptionChainResultRaw` → `OptionContractRaw` — with `catchTag("ParseError")` that logs `"Yahoo Finance options response shape changed: ..."` and fails with `HTTPError`.

## Testing

```bash
deno test --allow-env --allow-read --allow-net --allow-sys --allow-run cli/OptionsMenu/
```
