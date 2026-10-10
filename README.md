# Hyperfin

![](https://github.com/jfarid27/open-eth-terminal/actions/workflows/ci-test.yml/badge.svg)

A CLI Interface to Financial Markets.

## Installation

It is highly recommended to use Deno for this application. Node.js is supported but may have issues with some dependencies, and is generally insecure if a malicious actor gains access to your system.

### Deno

1.  Clone the repository. You can clone a specific version by using the `--branch` flag with a version tag name.
    Check the [releases](https://github.com/jfarid27/open-eth-terminal/releases) page for available version tags.
    ```bash
    git clone --depth 1 --branch <version_tag_name> https://github.com/jfarid27/open-eth-terminal.git
    ```
2.  Install dependencies:
    ```bash
    deno install -A --unstable --name=deno index.ts
    ```

### Node.js

1.  Clone the repository. You can clone a specific version by using the `--branch` flag with a version tag name.
    Check the [releases](https://github.com/jfarid27/open-eth-terminal/releases) page for available version tags.
    ```bash
    git clone --depth 1 --branch <version_tag_name> https://github.com/jfarid27/open-eth-terminal.git
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
    
### Environment Variables
Set up your environment variables:
    *   Create a `.env` file in the root directory.
    *   Add your API keys (and other configurations as needed):
        ```env
        COINGECKO_API_KEY=your_api_key_here
        FRED_API_KEY=your_fred_api_key_here
        MASSIVE_API_KEY=your_massive_api_key_here
        ALPHAVANTAGE_API_KEY=your_alphavantage_api_key_here
        # Alpaca uses a key/secret header pair (both required together)
        ALPACA_API_KEY=your_alpaca_key_id_here
        ALPACA_API_SECRET=your_alpaca_secret_here
        ENVIRONMENT=development # or production
        DEBUG=false
        ```
    
    To get a FRED API key, register at [https://fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html)

## Usage

### Deno
```bash
deno task cli
```

To run a script directly from the command line:
```bash
deno task cli --oet-script scripts/<filename>.txt
```

## Features

### General Usage

Start the system, and type specific commands to either enter into a new menu, or perform an action.
Actions will dump data and information in specific locations like the terminal itself, or files.

### Scripting

Scripting is a useful tool for users who want to perform automated analysis.

Create a scripts directory in the top level folder, and create a script file with any extension. You
can then run a script with the script command, and pass the filename as an argument. 

#### Running Scripts Interactively

From within the terminal, use the `script` command:
```bash
script <filename>.txt
```

#### Running Scripts from Command Line

You can also run scripts directly from the command line using the `--oet-script` flag. The terminal will execute the script and exit automatically:

**Deno:**
```bash
deno task cli --oet-script scripts/<filename>.txt
```

#### Example Script

An example script file could be as simple as the example below:

```bash
news
reddit wallstreetbets 10
reddit ethereum 10
back
stocks
spot TSLA
back
crypto
price ethereum
price aave
back
government
fred GNPCA 2020-01-01 2024-12-31
back
forex
spot EUR USD
chart EUR USD 2026-01-01 2026-06-30
back
```

### Hyperfin Packages (Custom Menu Entrypoints)

The `hyperfin-packages/` folder lets users extend the terminal with their
own top-level menus, without patching the project. Any directory dropped
in there that declares a `hyperfin-package.json` (or a `package.json`
with an `entry` field) is registered as a Main Menu option at startup.

```json
// hyperfin-packages/my-menu/hyperfin-package.json
{
  "name": "my-menu",
  "description": "What my menu does",
  "command": "mymenu",
  "entry": "index.ts"
}
```

The referenced `entry` module must export a `Menu` — either
`export const menu = registerTerminalApplication(myMenu)` or as the
default export. The package then behaves exactly like a built-in menu:
custom actions, submenus, tables and charts are all available.

Install a package by dropping a directory in (a plain `git clone` works):

```bash
git clone https://github.com/you/hyperfin-my-menu.git hyperfin-packages/my-menu
```

This folder is **not** a submodule directory. It does not collide with the
project's own `.gitmodules`: locally installed packages are ignored by git
(`/hyperfin-packages/*` in `.gitignore`, with the README and the bundled
`example-package/` tracked), so they stay out of version control and out
of the project's module list.

Notes:
- A package may not claim a built-in command; a collision is reported at
  startup and the package is skipped.
- Package entries are imported at startup; a package that throws is
  skipped with a message and never blocks startup.
- `entry` is resolved inside the package directory only — absolute paths
  and `..` traversal are rejected.

See [hyperfin-packages/README.md](hyperfin-packages/README.md) for the full
manifest reference, an install-from-git guide, and a complete working
example (`hyperfin-packages/example-package/`).

### Government Economic Data

The Government menu provides access to economic data from the Federal Reserve Economic Data (FRED) API.

To use the FRED features:
1. Set your FRED API key in the `.env` file or use the `keys` command: `keys fred your_api_key_here`
2. Navigate to the government menu: `government`
3. Use the `fred` command to fetch and chart economic data series:
   ```
   fred GNPCA 2020-01-01 2024-12-31
   ```
   Where:
   - `GNPCA` is the series ID (e.g., GNPCA for Gross National Product)
   - `2020-01-01` is the start date (YYYY-MM-DD format)
   - `2024-12-31` is the end date (YYYY-MM-DD format)

The chart will display the series data with the official series title from FRED.

You can find series IDs by browsing [FRED](https://fred.stlouisfed.org/).

### Foreign Exchange (Forex)

The Forex menu provides spot exchange rates and daily FX charts from the AlphaVantage API.

To use:
1. Set your AlphaVantage API key in the `.env` file (`ALPHAVANTAGE_API_KEY`) or use the `keys` command: `keys alphavantage your_api_key_here`
2. Navigate to the forex menu: `forex`
3. Fetch a spot rate for a pair: `spot EUR USD`
4. Chart the daily close for a pair (dates are optional, `YYYY-MM-DD`):
   ```
   chart EUR USD                       # trailing 1 year
   chart EUR USD 2026-01-01            # from 2026-01-01 through today
   chart EUR USD 2026-01-01 2026-06-30 # exactly this range
   ```

The chart title labels the pair and the resolved range, e.g. `EUR/USD FX - 2025-10-07 to 2026-10-07`.

### Options Chains

The Options menu provides access to stock options chain data from Yahoo Finance (no API key required).

To use:
1. Navigate to the options menu: `options`
2. Fetch the nearest expiration chain: `chain AAPL`
3. Fetch a specific expiration by index: `chain AAPL 3`
4. Fetch a specific expiration by date: `chain AAPL 2026-08-21`

The chain displays calls and puts in color-coded terminal-kit tables with contract symbol, ITM/OTM status, strike, last price, bid/ask, volume, open interest, and implied volatility.

To switch between sources (Yahoo Finance and Alpaca): `source alpaca` / `source yahoofinance`.

### Alpaca Market Data

[Alpaca's Market Data API](https://docs.alpaca.markets/us/docs/about-market-data-api)
is available as a data source for **stocks, options, forex, and (fixed-income)
bonds**. Authentication is a key/secret header pair — set `ALPACA_API_KEY` and
`ALPACA_API_SECRET` in `.env` (both required together).

Each menu picks its source with the `source` command:

```
stocks  → source alpaca   spot / chart
options → source alpaca   chain / volcurve
forex   → source alpaca   spot / chart
bonds   → source alpaca   yields <isin>
```

What Alpaca provides, per asset class (all on `https://data.alpaca.markets`):

| Menu | Spot | Historical | Feed / notes |
|------|------|------------|--------------|
| Stocks | `/{symbol}/snapshot` | `/v2/stocks/{symbol}/bars` (1Day) | free plan uses the IEX feed |
| Options | `/{underlying}` chain snapshots | `/v1beta1/options/bars` | **indicative** feed: no OI, no IV/greeks (OPRA is paid) |
| Forex | `/v1beta1/forex/latest/rates` | `/v1beta1/forex/rates` | bid/mid/ask only (no OHLC) |
| Bonds | `/v1beta1/fixed_income/latest/prices` (by ISIN) | — (latest only) | requires a fixed-income entitlement |

**Entitlements matter.** Alpaca gates forex and fixed-income data behind account
entitlements; without them the API returns `403` and the CLI prints Alpaca's own
message (e.g. `Alpaca (403) forbidden: insufficient grants`) instead of a generic
error. Alpaca fixed income is quoted by **ISIN**, not the `US2/US5/US10/US30`
codes used by the Yahoo Finance yield charts.

### Bonds

The Bonds menu supports both sources:

- **Yahoo Finance** (default): `yields US2|US5|US10|US30 [range]` charts the yield
  (CBOE yield indexes).
- **Alpaca**: `yields <isin>` prints the latest fixed-income price and yield (YTM/YTW)
  for the ISIN, e.g. `yields US912797KJ59`. Alpaca has no historical fixed-income
  endpoint, so historical yield charts remain Yahoo-only.

To switch: `source alpaca` / `source yahoofinance`.

## Development

### System Design

This application is in general a functionally typed state machine CLI. The general design is that the application registers,
a menu function that takes a [UserState] and definitions for the [Menu], and returns an updated or new [UserState]. Because of
this, the menu functions may recursively call back into themselves or a previous menu function to simulate a stack of menus.

Since the UserState is always available, parameter options may always be updated and the menu in general has access to it. When developing
new menus, ideally one should only need to register it with appropriate menu options, and actions which can paint to the terminal, and
return a new or updated user state. See the [types.ts](types.ts) file for more information, or look at a menu implementation for
a motivation for how menu configuration and actions are structured.

### Development and Info Logging

The application has a debug mode that can be enabled by setting the `DEBUG` environment variable to `true`. This will enable
info logging to the console. The debug mode is also available in the application itself, and can be toggled by the user.

See the UserStateConfig type for more information.

### LLM Agents

LLM Agent files are located in the `skills`, `.claude`, and `.gemini` folders. If you are an
agent, please refer to these files for more information about context and
skills.

### Generated Files

Generated files are located in the `tmp`, `data`, and `scripts` folders. These files should not be committed to the repository
so individual users can have their own generated files.

### Debugging

Run the application with the `dev:debug` script, then attach your favorite debugger to the process.
There is a vscode launch configuration for this called "Deno: Attach".

```bash
deno task dev:debug
```

## License

This project is licensed under the LGPL-3.0-or-later. See the [LICENSE.md](LICENSE.md) file for details.
