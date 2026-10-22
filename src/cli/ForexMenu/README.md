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
- Alpaca's history request covers the trailing year; a chart range older than that
  comes back empty and says so (AlphaVantage's `FX_DAILY` keeps full history).

## Failures are reported, not swallowed

Each source's requests run through `catchProgramError` / `catchAlpaca`
(`src/cli/utils/`), which print *why* a command failed. Without that, any handler
error is reduced to a bare `CommandResultType.Error` and both front ends show only
`Invalid command` — a missing key, a 403 and a typo all look the same.

- **No key.** `ALPHAVANTAGE_API_KEY` / `ALPACA_API_KEY` + `ALPACA_API_SECRET` are
  read per request, not when the layer is built, so a missing key fails the
  command that needs it with the variable to set. It no longer takes the whole menu
  down: both services are merged into `ForexServiceMenuLive`, so a layer-level read
  used to break *both* sources at once.
- **`keys` applies to the running session.** `keys alphavantage <key>` mirrors the
  value into `ALPHAVANTAGE_API_KEY`, which is what the services actually read
  (`ConfigService` is `process.env`). The value is masked in the session log.
- **Pair not carried.** A pair the source does not quote fails with a message
  naming the pair and suggesting the inverse (e.g. `chart JPY USD` → try
  `chart USD JPY`). Alpaca answers an unknown pair with an empty `rates` map
  rather than an error, so this is the only way to tell the difference.

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

- **technicals** `technicals`
  - Opens the indicator submenu (`Forex Technicals Menu`). Every command takes the
    currency pair first, then the indicator's own parameters; all arguments are
    optional so a bare command prints its usage instead of aborting:
    ```
    bbands EUR USD                  # Bollinger envelope, 20-bar / 2σ
    bbands EUR USD 10 3             # custom period and envelope width
    fibonacci EUR USD               # retracement levels over the latest swing
    fibonacci EUR USD 120           # narrow the swing to the last 120 bars
    returns EUR USD                 # daily percent returns, ±2σ guide bands
    ```
  - The series measured is the active source's **daily rate over the trailing year**
    (≈252 bars): AlphaVantage `FX_DAILY` (which carries ~20 years, narrowed here) or
    Alpaca `/v1beta1/forex/rates` (trailing year, mid rate — no OHLC). The shared
    window keeps the two sources comparable and the chart legible; `fibonacci`'s
    optional `lookback` narrows it further.
  - Failures are reported per source: a missing key names its variable, Alpaca's
    `403 forbidden: insufficient grants` explains the entitlement, and a pair the
    source does not carry says so instead of charting an empty series.

Rates are printed at the precision their magnitude calls for — four decimals for a
major (`EUR/USD` → `1.0854`), seven for a JPY cross (`JPY/USD` → `0.0063200`), which
`toFixed(4)` would have shown as a bare `0.0065`.

## Architecture

```
ForexMenu/
├── actions/
│   ├── alphavantage.ts        # forexSpotHandler, forexChartHandler, parsePair
│   ├── alpaca.ts              # forexSpotHandler, forexChartHandler (Alpaca)
│   ├── technicals.ts          # pair → daily series, then the shared indicator steps
│   └── *_test.ts              # Action-level tests (mocked services)
├── TechnicalsMenu/
│   ├── menu.ts                # bbands / fibonacci / returns options (pure)
│   └── index.ts               # Menu object + registration
├── services/
│   └── index.ts               # ForexServiceMenuLive layer (ForexService + Alpaca + ChartRenderer)
├── index.ts                   # Menu registration + per-source dispatch
└── README.md
```

The indicators themselves are **not** reimplemented here. `actions/technicals.ts`
resolves the pair to a `{ symbol, points }` series and hands it to the exported
`runBollinger` / `runFibonacci` / `runReturns` steps in
`CryptoMenu/actions/technicals.ts` — the same code the crypto, DEX and stocks menus
use — so the math and overlays cannot drift between menus. Bollinger/Fibonacci math
lives in `src/technicals/`, the Plot marks in `src/technicals/overlays.ts`.

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
