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
  - `symbol` is optional and falls back to the loaded token, e.g. `technicals bbands bitcoin 20 2`.
  - Technicals request a longer daily series than `chart` (CoinGecko returns only 14 days by default, which cannot fill a 20-bar window).
- **set**
  - Usage: `set <settingtype> [value]`
  - Description: Set or get loading options

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

