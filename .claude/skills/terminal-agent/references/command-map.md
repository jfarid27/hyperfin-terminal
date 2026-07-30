# Open Eth Terminal Command Map

## Main Menu

### Crypto Menu

-   **price**: `price [symbol]` - Fetch current price for the given symbol
-   **chart**: `chart [symbol]` - Fetch chart for the given symbol
-   **set**: `set <settingtype> [value]` - Set or get loading options

### Government Menu

-   **fred**: `fred [seriesId] [startDate] [endDate]` - Fetch and chart FRED economic data series (dates in YYYY-MM-DD format)

### News Menu

-   **reddit**: `reddit` - Navigate to the reddit menu

    #### Reddit Menu

    -   **subreddit**: `subreddit [subreddit] [limit]` - Fetch top posts from the given subreddit
    -   **search**: `search [query] [limit]` - Search for posts from the given query

### Prediction Market Menu

-   **polymarket**: `polymarket` - Enter the polymarket menu

    #### Polymarket Menu

    -   **top**: `top [limit] [term]` - Fetch the top polymarket markets.
    -   **event**: `event [slug]` - Fetch a specific event by slug.
    -   **portfolio analysis**: `portfolio [type] [filename].csv` - Give spot or chart analysis of a portfolio of polymarket positions.
    -   **market**: `market <slug> [type]` - Fetch a specific market by slug.
    -   **markets**: `markets [tag]` - Fetch markets for the given tag (default: all)
    -   **search**: `search [symbol]` - Fetch available event and market tags useful for filtering.
    -   **user positions**: `user [address]` - Fetch user positions for the given address.
    -   **load**: `load` - Fetch available event and market tags useful for filtering.

-   **kalshi**: `kalshi` - Enter the kalshi menu

    #### Kalshi Menu

    -   **event**: `event [ticker]` - Fetch markets for a specific event by ticker (e.g., KXHIGHNY-26JAN10).

### Stocks Menu

-   **chart**: `chart [symbol]` - Fetch chart data for the given symbol
-   **spot**: `spot [symbol]` - Fetch spot prices for the given symbol
