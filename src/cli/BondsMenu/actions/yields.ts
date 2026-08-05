import chalk from "chalk";
import { YahooFinanceBonds } from "../../../services/BondsService/YahooFinanceBondsService.ts";
import { ChartRenderer } from "../../StocksMenu/services/ChartRenderer.ts";
import { BOND_TICKER_MAP, type YieldPoint } from "../../../services/BondsService/types.ts";
import { DataSourceType, TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType } from "../../types.ts";
import { Effect } from "effect";

/**
 * Parse a bond code like "US10" into its Yahoo ticker and label.
 * Returns null if the code is unknown.
 */
const parseBondCode = (code: string): { ticker: string; label: string } | null => {
  const upper = code.toUpperCase();
  const entry = BOND_TICKER_MAP[upper];
  if (entry) return entry;

  // Try matching partial: e.g. "10" -> "US10"
  const match = Object.entries(BOND_TICKER_MAP).find(([key]) =>
    key.endsWith(upper) || key.replace("US", "").endsWith(upper)
  );
  if (match) return match[1];

  return null;
};

export const yieldsHandler = (bondCode: string, range?: string) =>
  Effect.gen(function* () {
    const st = yield* TerminalUserStateConfigContext;

    if (!bondCode) {
      console.log(chalk.red("No bond code provided. Usage: yields <code> [range]"));
      console.log(chalk.dim("Available codes: US2, US5, US10, US30"));
      console.log(chalk.dim("Optional range: 1mo, 3mo, 6mo, 1y (default), 2y, 5y, 10y, max"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const parsed = parseBondCode(bondCode);
    if (!parsed) {
      console.log(chalk.red(`Unknown bond code: ${bondCode}`));
      console.log(chalk.dim("Available codes: US2, US5, US10, US30"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    const symbolObj = {
      name: parsed.label,
      id: parsed.ticker,
      _type: DataSourceType.YahooFinance,
    };

    const yf = yield* YahooFinanceBonds;
    const rangeStr = range || "1y";

    yield* Effect.logInfo(`Fetching ${parsed.label} bond yields (range=${rangeStr})`);

    const points: readonly YieldPoint[] = yield* yf.getYields(symbolObj, rangeStr);

    if (points.length === 0) {
      console.log(chalk.red("No yield data returned"));
      return { result: { type: CommandResultType.Error }, state: st };
    }

    // Show latest yield
    const latest = points[points.length - 1];
    const first = points[0];
    const change = latest.close - first.close;
    const direction = change >= 0 ? chalk.green("▲") : chalk.red("▼");
    const changeColor = change >= 0 ? chalk.green : chalk.red;

    console.log(chalk.bold(`\n${parsed.label} Bond Yield`));
    console.log(`Latest: ${chalk.bold.white(`${latest.close.toFixed(3)}%`)}  ${direction} ${changeColor(`${change.toFixed(3)}%`)}`);
    console.log(`Range:  ${first.date} → ${latest.date}  ·  ${points.length} data points\n`);

    // Render chart
    const chart = yield* ChartRenderer;
    yield* chart.render(
      [...points] as unknown as Record<string, unknown>[],
      "date",
      "close",
      `${parsed.label} Yield (${rangeStr})`,
    );

    return { result: { type: CommandResultType.Success }, state: st };
  });
