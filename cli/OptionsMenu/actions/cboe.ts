import chalk from "chalk";
import { ActionHandler, DataSourceType, TerminalUserStateConfigContext } from "./../../types.ts";
import {
    CommandResultType,
} from "./../../types.ts";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import { Effect } from "effect";
import { CboeService } from "cli/services/CboeService.ts";
import { lensPath, view } from "ramda";

// Lens for the loaded token on the user state config.
const tokenLens = lensPath(["loadedContext", "token", "symbol"]);

// View the loaded token on the user state config.
const getLoadedToken = view(tokenLens);

/**
 * Display a CBOE options chain in a terminal table.
 */
const displayOptionsChain = (chain: any) => {
  const contracts = chain.contracts ?? [];
  if (contracts.length === 0) {
    console.log(chalk.yellow("No options contracts found."));
    return;
  }

  // Show a summary first
  console.log(chalk.green(`\nOptions Chain for ${chain.ticker} (Underlying: $${chain.underlyingPrice?.toFixed(2) ?? "N/A"})`));
  console.log(chalk.gray(`Showing ${contracts.length} contracts\n`));

  // Show first 20 contracts in a table
  const rows = contracts.slice(0, 20).map((c: any) => [
    c.symbol,
    c.type?.toUpperCase(),
    c.expiration,
    c.strike.toFixed(2),
    c.bid.toFixed(2),
    c.ask.toFixed(2),
    c.lastPrice.toFixed(2),
    c.volume.toLocaleString(),
    c.openInterest.toLocaleString(),
  ]);

  terminal.table([
    ["Symbol", "Type", "Expiration", "Strike", "Bid", "Ask", "Last", "Volume", "Open Interest"],
    ...rows,
  ], {
    hasBorder: true,
    contentHasMarkup: true,
    borderChars: "lightRounded",
    borderAttr: { color: "cyan" },
    textAttr: { bgColor: "default" },
    firstRowTextAttr: { bgColor: "cyan" },
    width: 180,
    fit: true,
  });
};

export const optionsChainHandler: ActionHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;

  const loadedTokenSymbol: string | undefined = symbolStr || getLoadedToken(st);

  if (!loadedTokenSymbol) {
    console.log("No symbol provided");
    return {
      result: { type: CommandResultType.Error },
      state: st,
    };
  }

  // Determine datasource from context, default to CBOE
  const datasource = st.loadedContext?.options?.datasource ?? DataSourceType.CBOE;

  if (datasource === DataSourceType.CBOE) {
    const cboe = yield* CboeService;
    const result = yield* cboe.getOptionsChain(loadedTokenSymbol.toUpperCase());
    displayOptionsChain(result);
  } else {
    console.log(chalk.yellow("Massive options data not yet implemented. Defaulting to CBOE."));
    const cboe = yield* CboeService;
    const result = yield* cboe.getOptionsChain(loadedTokenSymbol.toUpperCase());
    displayOptionsChain(result);
  }

  return {
    result: { type: CommandResultType.Success },
    state: st,
  };
});
