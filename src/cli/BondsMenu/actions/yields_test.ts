import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import { yieldsHandler, bondYieldChartTitle } from "./yields.ts";
import { ChartRenderer } from "../../StocksMenu/services/ChartRenderer.ts";
import { YahooFinanceBonds } from "src/services/BondsService/YahooFinanceBondsService.ts";
import { BondSymbolType, type YieldPoint } from "src/services/BondsService/types.ts";
import { TerminalUserStateConfigContext } from "../../types.ts";
import { CommandResultType, DataSourceType, EnvironmentType, LogLevel } from "../../types.ts";
import type { TerminalUserStateConfig } from "../../types.ts";

// ── Fixtures ──

const mockPoints: YieldPoint[] = [
  { timestamp: 1751299200, date: "2026-06-30", close: 4.21 },
  { timestamp: 1759248000, date: "2026-09-30", close: 4.37 },
  { timestamp: 1759622400, date: "2026-10-05", close: 4.42 },
];

let renderedTitle: string | undefined;

const mockBonds = Layer.succeed(YahooFinanceBonds, {
  getYields: (_symbol: BondSymbolType, _range?: string) => Effect.succeed(mockPoints),
});

const mockChartRenderer = Layer.succeed(ChartRenderer, {
  render: (_data, _x, _y, title) => {
    renderedTitle = title;
    return Effect.succeed(undefined);
  },
});

const baseState: TerminalUserStateConfig = {
  environment: EnvironmentType.Development,
  logLevel: LogLevel.None,
  sessionPath: "",
  apiKeys: {
    coingecko: undefined,
    alphavantage: undefined,
    blockchaincom: undefined,
    freecryptoapi: undefined,
    fred: undefined,
    massive: undefined,
    yahoofinance: undefined,
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
  },
  scriptContext: {},
};

const mockState = Layer.succeed(TerminalUserStateConfigContext, baseState);

const run = () =>
  Effect.runPromise(
    yieldsHandler("US10", "1y").pipe(
      Effect.provide(Layer.mergeAll(mockBonds, mockChartRenderer, mockState)),
    ),
  );

// ── Tests ──

describe("bondYieldChartTitle", () => {
  it("formats as 'Bond Yields - <Tenure> - <YYYY-MM-DD>'", () => {
    expect(bondYieldChartTitle("10-Year", "2026-10-05"),
      "Title should carry tenure and the latest data date"
    ).toBe("Bond Yields - 10-Year - 2026-10-05");
  });
});

describe("yieldsHandler chart title", () => {
  it("titles the chart with the bond tenure and latest date", async () => {
    renderedTitle = undefined;

    const result = await run();

    expect(result.result.type,
      "Handler should succeed"
    ).toBe(CommandResultType.Success);
    expect(renderedTitle,
      "Chart should be titled 'Bond Yields - <Tenure> - <YYYY-MM-DD>'"
    ).toBe("Bond Yields - 10-Year - 2026-10-05");
  });

  it("uses the tenor of the requested bond code", async () => {
    renderedTitle = undefined;

    await Effect.runPromise(
      yieldsHandler("US30").pipe(
        Effect.provide(Layer.mergeAll(mockBonds, mockChartRenderer, mockState)),
      ),
    );

    expect(renderedTitle,
      "US30 should be titled as the 30-Year"
    ).toBe("Bond Yields - 30-Year - 2026-10-05");
  });

  it("errors on an unknown bond code without rendering a chart", async () => {
    renderedTitle = undefined;

    const result = await Effect.runPromise(
      yieldsHandler("NOPE").pipe(
        Effect.provide(Layer.mergeAll(mockBonds, mockChartRenderer, mockState)),
      ),
    );

    expect(result.result.type,
      "Unknown code should be an error"
    ).toBe(CommandResultType.Error);
    expect(renderedTitle,
      "No chart should be rendered for an unknown code"
    ).toBe(undefined);
  });

  it("uses the Yahoo ticker for the requested bond", async () => {
    const seen: BondSymbolType[] = [];
    const spyBonds = Layer.succeed(YahooFinanceBonds, {
      getYields: (symbol: BondSymbolType, _range?: string) => {
        seen.push(symbol);
        return Effect.succeed(mockPoints);
      },
    });

    await Effect.runPromise(
      yieldsHandler("US5").pipe(
        Effect.provide(Layer.mergeAll(spyBonds, mockChartRenderer, mockState)),
      ),
    );

    expect(seen[0]?.id,
      "US5 should resolve to the 5-Year CBOE yield index"
    ).toBe("^FVX");
    expect(seen[0]?._type,
      "Bond yields come from Yahoo Finance"
    ).toBe(DataSourceType.YahooFinance);
  });
});
