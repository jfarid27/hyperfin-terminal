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
        ENVIRONMENT=development # or production
        DEBUG=false
        ```
    
    To get a FRED API key, register at [https://fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html)

## Usage

### Deno
```bash
deno run start 
```

To run a script directly from the command line:
```bash
deno run start --oet-script scripts/<filename>.txt
```

### Node.js
```bash
npx tsx index.ts
```

To run a script directly from the command line:
```bash
npx tsx index.ts --oet-script scripts/<filename>.txt
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
deno run start --oet-script scripts/<filename>.txt
```

**Node.js:**
```bash
npx tsx index.ts --oet-script scripts/<filename>.txt
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
```

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
deno run dev:debug
```

## License

This project is licensed under the LGPL-3.0-or-later. See the [LICENSE.md](LICENSE.md) file for details.
