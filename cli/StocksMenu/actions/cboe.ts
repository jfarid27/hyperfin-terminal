import chalk from "chalk";
import { ActionHandler, TerminalUserStateConfigContext } from "./../../types.ts";
import { CommandResultType } from "./../../types.ts";
import { showLineChart } from "./../../components/charting.ts";
import { lensPath, view } from "ramda";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import { Effect } from "effect";
import { CboeModel } from "../model/cboe.ts";
import { StocksServiceLive } from "../services/index.ts";

const tokenLens = lensPath(["loadedContext", "token", "symbol"]);
const getLoadedToken = view(tokenLens);

const displayCboeQuote = (quote: any) => {
  terminal.table([
    ["Symbol", "Price", "Change", "Change %", "Volume", "Open", "High", "Low", "Prev Close"],
    [
      quote.ticker,
      `$${quote.lastPrice.toFixed(2)}`,
      quote.change.toFixed(2),
      quote.changePercent.toFixed(2) + "%",
      quote.volume.toLocaleString(),
      quote.open.toFixed(2),
      quote.high.toFixed(2),
      quote.low.toFixed(2),
      quote.previousClose.toFixed(2),
    ],
  ], {
    hasBorder: true,
    contentHasMarkup: true,
    borderChars: "lightRounded",
    borderAttr: { color: "green" },
    textAttr: { bgColor: "default" },
    firstRowTextAttr: { bgColor: "green" },
    width: 140,
    fit: true,
  });
};

export const cboeSpotPriceHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }
  const cboe = yield* CboeModel;
  const result = yield* cboe.spot.get({ name: symbol, id: symbol.toUpperCase(), _type: "cboe" as any });
  displayCboeQuote(result);
  return { result: { type: CommandResultType.Success }, state: st };
}).pipe(
  Effect.provide(StocksServiceLive)
);

export const cboeHistoryHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }
  const cboe = yield* CboeModel;
  const result = yield* cboe.history.get({ name: symbol, id: symbol.toUpperCase(), _type: "cboe" as any });
  yield* showLineChart(result as Record<string, any>[], "date", "close", `${symbol} Historical Prices`);
  return { result: { type: CommandResultType.Success }, state: st };
}).pipe(
  Effect.provide(StocksServiceLive)
);

export const cboeOptionsChainHandler = (symbolStr: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const symbol = symbolStr || getLoadedToken(st);
  if (!symbol) {
    console.log("No symbol provided");
    return { result: { type: CommandResultType.Error }, state: st };
  }
  const cboe = yield* CboeModel;
  const result = yield* cboe.options.chain({ name: symbol, id: symbol.toUpperCase(), _type: "cboe" as any });
  const contracts = (result as any).contracts ?? [];
  if (contracts.length === 0) {
    console.log(chalk.yellow("No options contracts found."));
    return { result: { type: CommandResultType.Success }, state: st };
  }
  console.log(chalk.green(`\nOptions Chain for ${(result as any).ticker} (Underlying: $${(result as any).underlyingPrice?.toFixed(2) ?? "N/A"})`));
  console.log(chalk.gray(`Showing ${contracts.length} contracts\n`));
  const rows = contracts.slice(0, 20).map((c: any) => [
    c.symbol, c.type?.toUpperCase(), c.expiration,
    c.strike.toFixed(2), c.bid.toFixed(2), c.ask.toFixed(2),
    c.lastPrice.toFixed(2), c.volume.toLocaleString(), c.openInterest.toLocaleString(),
  ]);
  terminal.table([
    ["Symbol", "Type", "Expiration", "Strike", "Bid", "Ask", "Last", "Volume", "Open Interest"],
    ...rows,
  ], {
    hasBorder: true, contentHasMarkup: true, borderChars: "lightRounded",
    borderAttr: { color: "cyan" }, textAttr: { bgColor: "default" },
    firstRowTextAttr: { bgColor: "cyan" }, width: 180, fit: true,
  });
  return { result: { type: CommandResultType.Success }, state: st };
}).pipe(
  Effect.provide(StocksServiceLive)
);
