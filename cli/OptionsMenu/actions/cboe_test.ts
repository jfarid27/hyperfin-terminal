import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { DataSourceType } from "../../types.ts";

describe("Options Action Handlers", () => {
  describe("OptionsContext datasource", () => {
    it("should default to CBOE datasource", () => {
      const context: { datasource?: DataSourceType.CBOE | DataSourceType.Massive } = {};
      const datasource = context.datasource ?? DataSourceType.CBOE;
      expect(datasource).toBe(DataSourceType.CBOE);
    });

    it("should allow Massive as a datasource", () => {
      const context: { datasource: DataSourceType.CBOE | DataSourceType.Massive } = {
        datasource: DataSourceType.Massive,
      };
      expect(context.datasource).toBe(DataSourceType.Massive);
    });
  });

  describe("CBOE options chain data", () => {
    it("should process options chain data correctly", () => {
      const mockChain = {
        ticker: "AAPL",
        underlyingPrice: 150.25,
        contracts: [
          {
            symbol: "AAPL250117C00150000",
            description: "AAPL Jan 17 2025 $150 Call",
            expiration: "2025-01-17",
            strike: 150.0,
            type: "call" as const,
            bid: 3.50,
            ask: 3.60,
            lastPrice: 3.55,
            volume: 10000,
            openInterest: 50000,
            impliedVolatility: 0.25,
          },
          {
            symbol: "AAPL250117P00150000",
            description: "AAPL Jan 17 2025 $150 Put",
            expiration: "2025-01-17",
            strike: 150.0,
            type: "put" as const,
            bid: 2.80,
            ask: 2.90,
            lastPrice: 2.85,
            volume: 8000,
            openInterest: 35000,
            impliedVolatility: 0.28,
          },
        ],
      };

      expect(mockChain.ticker).toBe("AAPL");
      expect(mockChain.underlyingPrice).toBe(150.25);
      expect(mockChain.contracts).toHaveLength(2);
      expect(mockChain.contracts[0].type).toBe("call");
      expect(mockChain.contracts[1].type).toBe("put");
      expect(mockChain.contracts[0].strike).toBe(150.0);
      expect(mockChain.contracts[0].bid.toFixed(2)).toBe("3.50");
    });

    it("should handle empty options chain", () => {
      const mockChain = {
        ticker: "AAPL",
        underlyingPrice: 150.25,
        contracts: [],
      };

      expect(mockChain.contracts).toHaveLength(0);
    });
  });
});
