# Crypto Menu

Fetch crypto prices from various sources.

## Commands

- **price**
  - Usage: `price [symbol]`
  - Description: Fetch current price for the given symbol
- **chart**
  - Usage: `chart [symbol]`
  - Description: Fetch chart for the given symbol
- **technicals**
  - Usage: `technicals [technicalType] [symbol] [arg1] [arg2]`
  - Description: Technical indicators charted over the price series.
    - `bbands` — Bollinger Bands. `arg1` = period (default 20), `arg2` = standard deviations (default 2).
    - `fibonacci` — Fibonacci retracement levels over the latest swing. `arg1` = swing lookback in bars (default: the whole series).
    - `returns` — Daily percent returns (each price against the previous price), drawn as bars coloured by sign: blue for an up day, red for a down day, against a zero baseline.
  - `symbol` is optional and falls back to the loaded token, e.g. `technicals bbands bitcoin 20 2`.
  - Technicals request a longer daily series than `chart` (CoinGecko returns only 14 days by default, which cannot fill a 20-bar window).
- **set**
  - Usage: `set <settingtype> [value]`
  - Description: Set or get loading options
- **dex**
  - Usage: `dex`
  - Description: Enter the DEX submenu, which prices on-chain tokens by contract address
    rather than by ticker. Currently `ethereum`: `spot [address]`, `chart [address] [interval]`
    and `technicals` (bbands / fibonacci / returns), all keyed by an ERC-20 contract address.
    Requires `CMC_API_KEY`.
- **fg**
  - Usage: `fg`
  - Description: CoinMarketCap Fear & Greed index (0-100) with CoinMarketCap's own band label.
    Requires `CMC_API_KEY`.
- **altcoin**
  - Usage: `altcoin`
  - Description: CoinMarketCap Altcoin Season index (0-100), with the trailing year's range
    and the combined altcoin market cap. Requires `CMC_API_KEY`.

## DEX submenu (on-chain tokens)

The `crypto` menu looks tokens up by ticker, which cannot reach a token that only
trades on a DEX: it has no CoinGecko coin id. `dex` → `ethereum` looks them up by
contract address instead, using CoinMarketCap's DEX endpoints
(`/v1/dex/token` for price and metadata, `/v1/k-line/candles` for the series).

- `spot [address]` — price, 24h change/volume/range, market cap and liquidity.
- `chart [address] [interval]` — candle closes as a line chart. `interval` defaults
  to `1d`; `4h`, `1h`, `15min`, `5min`, `1min` also work.
- `technicals` — the same bbands / fibonacci / returns indicators as above, over
  the token's daily candles.

Every action takes an optional leading contract address and falls back to the
loaded DEX address, e.g. `spot 0x49b5a631f54927c0007232844f06fe18cbf69786`.

Notes on this source:

- The address must be the **token** contract, not a pool address (a pool address
  returns an empty series).
- A plan without DEX historical access refuses an explicit date range (`from`),
  so the whole series is fetched and the indicator's own lookback does the
  narrowing.
- Launch-day candles for a brand-new token can be junk (a thin initial pool
  prints a 1000x spike) and dominate a chart's y-axis; that is the data, not a
  rendering bug.

## Indicators

The indicator math lives in `src/technicals/` (pure, unit-tested) and the Plot
marks in `src/technicals/overlays.ts`; the menu actions only fetch data and hand
the overlays to the shared `ChartRenderer`.

- **Bollinger Bands** — an SMA basis with an envelope of ±k population standard
  deviations. Read as a volatility regime: the bands widen when the series is
  volatile. Uses the population deviation (divide by the period), matching
  TradingView.
- **Fibonacci retracement** — the max/min of a trailing window define the
  swing. 0% sits at the *end* of the swing (the high of an up move, the low of a
  down move) and 100% at its start; the intermediate ratios are candidate
  support levels. Ratios are drawn as dashed rules, labelled by ratio on the
  right edge and by price on the left.

