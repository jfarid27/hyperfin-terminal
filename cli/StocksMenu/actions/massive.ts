import chalk from "chalk";
import { ActionHandler, DataSourceType, TerminalUserStateConfigContext, CommandResultType } from "../../types.ts";
import { Effect } from "effect";
import { ConfigService } from "cli/services/ConfigService.ts";
import { Option } from "effect";
import { MassiveModel } from "../model/massive.ts";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;

export const massiveSpotPriceHandler: ActionHandler = (symbol: string) => Effect.gen(function* () {
  const st = yield* TerminalUserStateConfigContext;
  const config = yield* ConfigService;
  const key = Option.getOrUndefined(config.MASSIVE_API_KEY) || "";
  const massive = yield* MassiveModel;

  const raw = yield* massive.spot.get(
    { name: symbol, id: symbol.toUpperCase(), _type: DataSourceType.Massive },
    key,
  );
  const result = raw as any;
  const ticker = result?.ticker;
  if (!ticker) {
    console.log(chalk.red("No data returned from Massive API"));
    return { result: { type: CommandResultType.Error }, state: st };
  }
  const day = result?.day;
  const prevDay = result?.prevDay;
  terminal.table([
    ["Symbol", "Price", "Change", "Change %", "Volume", "Prev Close", "High", "Low"],
    [ticker.ticker, `$${ticker.price || ticker.lastTrade?.p || "N/A"}`,
      day?.c?.toFixed(2) ?? "N/A", day?.cp != null ? day.cp.toFixed(2) + "%" : "N/A",
      day?.v?.toLocaleString() ?? "N/A", prevDay?.c?.toFixed(2) ?? "N/A",
      day?.h?.toFixed(2) ?? "N/A", day?.l?.toFixed(2) ?? "N/A"],
  ], {
    hasBorder: true, contentHasMarkup: true, borderChars: "lightRounded",
    borderAttr: { color: "green" }, textAttr: { bgColor: "default" },
    firstRowTextAttr: { bgColor: "green" }, width: 120, fit: true,
  });
  return { result: { type: CommandResultType.Success }, state: st };
});
