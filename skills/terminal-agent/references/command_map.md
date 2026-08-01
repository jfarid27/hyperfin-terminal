# Open Eth Terminal Command Map

This document provides a visual tree of every terminal command and its associated submenu within the Open Eth Terminal application.

## Application Entry Points

The application has two entry points:

- **`index.ts`** — Classic CLI mode (`deno task cli`). Uses `registerTerminalApplication` with commander-based command parsing.
- **`terminal.ts`** — Bloomberg-style TUI mode (`deno task terminal`). Uses `HyperFinTerminal` with terminal-kit full-screen rendering.

Both share the same menu infrastructure (sub-terminals, actions, models) from the `cli/` folder.

## Command Tree

### Main Menu (CLI & TUI)

- **`crypto`**: Fetch crypto prices from various sources
    - **`price [symbol]`**: Fetch current price for the given symbol
    - **`chart [symbol]`**: Fetch chart for the given symbol
    - **`set <settingtype> [value]`**: Set or get loading options (e.g., `datasource`, `symbol`)
    - *Global Options*: `exit`, `back`, `showconfig` (dev only)

- **`stocks`**: Fetch stock prices from various sources
    - **`chart [symbol]`**: Fetch chart data for the given symbol
    - **`spot [symbol]`**: Fetch spot prices for the given symbol
    - *Global Options*: `exit`, `back`, `showconfig` (dev only)

- **`options`**: Fetch options data from various sources
    - *Global Options*: `exit`, `back`, `showconfig` (dev only)

- **`news`**: Fetch news from various sources
    - **`reddit`**: Navigate to the reddit menu
        - **`subreddit [subreddit] [limit]`**: Fetch top posts from the given subreddit
        - **`search [query] [limit]`**: Search for posts from the given query
        - *Global Options*: `exit`, `back`, `showconfig` (dev only)
    - *Global Options*: `exit`, `back`, `showconfig` (dev only)

- **`predictions`**: Fetch prediction markets prices from various sources
    - **`polymarket`**: Enter the polymarket menu
        - **`top [limit] [term]`**: Fetch the top polymarket markets.
        - **`event [slug]`**: Fetch a specific event by slug.
        - **`portfolio [type] [filename].csv`**: Give spot or chart analysis of a portfolio of polymarket positions.
        - **`market <slug> [type]`**: Fetch a specific market by slug.
        - **`markets [tag]`**: Fetch markets for the given tag (default: all).
        - **`search [symbol]`**: Fetch available event and market tags useful for filtering.
        - **`user [address]`**: Fetch user positions for the given address.
        - **`load`**: Fetch available event and market tags useful for filtering.
        - *Global Options*: `exit`, `back`, `showconfig` (dev only)
    - **`kalshi`**: Enter the kalshi menu
        - **`event [ticker]`**: Fetch markets for a specific event by ticker.
        - *Global Options*: `exit`, `back`, `showconfig` (dev only)
    - *Global Options*: `exit`, `back`, `showconfig` (dev only)

- **`government`**: Fetch government economic data from various sources
    - **`fred [seriesId] [startDate] [endDate]`**: Fetch and chart FRED economic data series.
    - *Global Options*: `exit`, `back`, `showconfig` (dev only)

- **`chat`** *(TUI only)*: Open XMTP chat — message other users on the XMTP network

- **`script [filename]`**: Run a script from the scripts folder with a specified filename

- **`keys [type] [value]`**: Set or get the API keys

- **`exit`**: Exit the application

- **`back`**: Go back to the previous menu

- **`showconfig`**: Show the current configuration (Development only)

## TUI-Specific Features

The Bloomberg-style TUI (`terminal.ts`) provides:

- **Full-screen layout** with data area, command input line, and menu bar
- **Number key shortcuts** for menu options (e.g., press `1` for crypto)
- **Command typing** — type commands directly (e.g., `crypto`, `stocks spot AAPL`)
- **Console output capture** — action output is displayed in the data area
- **XMTP chat integration** — real-time messaging via the XMTP network
- **Key bindings**: `↑↓` navigate, `Tab` switch panes, `Enter` send, `Esc` exit

## Architecture

```
terminal/
├── index.ts              — Entry point: startHyperFin(), menu options, state init
├── HyperFinTerminal.ts   — Main TUI loop, keybinding dispatch, command execution
├── MainPanel.ts          — Full-screen layout (data area, command input, menu bar)
└── xmtp/
    ├── client.ts         — XMTP chat client (connect, send, receive)
    ├── ChatPanel.ts      — Chat UI (contacts pane, messages, input)
    └── account.ts        — XMTP key generation and storage
```

The terminal reuses all CLI infrastructure:
- `cli/types.ts` — `Menu`, `MenuOption`, `ActionHandler`, `CommandState`, etc.
- `cli/services/TerminalUserState.ts` — `TerminalUserStateConfig` and `TerminalUserStateConfigContext`
- `cli/errors/index.ts` — `ProgramError` tagged errors
- `cli/{Menu}/` — Sub-terminal menus (Crypto, Stocks, News, etc.)
