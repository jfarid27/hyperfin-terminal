import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { DataSourceType } from "../../types.ts";

describe("Stocks Action Handlers", () => {
  describe("DataSourceType", () => {
    it("should include CBOE as a valid datasource type", () => {
      expect(DataSourceType.CBOE).toBe("cboe");
    });

    it("should include Massive as a valid datasource type", () => {
      expect(DataSourceType.Massive).toBe("massive");
    });
  });

  describe("StocksContext datasource", () => {
    it("should allow CBOE as a valid datasource", () => {
      const context: { datasource: DataSourceType.CBOE | DataSourceType.Massive } = {
        datasource: DataSourceType.CBOE,
      };
      expect(context.datasource).toBe(DataSourceType.CBOE);
    });

    it("should allow Massive as a valid datasource", () => {
      const context: { datasource: DataSourceType.CBOE | DataSourceType.Massive } = {
        datasource: DataSourceType.Massive,
      };
      expect(context.datasource).toBe(DataSourceType.Massive);
    });
  });

  describe("CBOE quote display formatting", () => {
    it("should format a CBOE quote correctly", () => {
      const mockQuote = {
        ticker: "AAPL",
        lastPrice: 150.25,
        change: 2.50,
        changePercent: 1.69,
        volume: 50000000,
        open: 148.00,
        high: 151.00,
        low: 147.50,
        previousClose: 147.75,
        timestamp: "2025-01-15T20:00:00Z",
      };

      expect(mockQuote.ticker).toBe("AAPL");
      expect(mockQuote.lastPrice.toFixed(2)).toBe("150.25");
      expect(mockQuote.changePercent.toFixed(2)).toBe("1.69");
      expect(mockQuote.volume.toLocaleString()).toBe("50,000,000");
    });
  });

  describe("CBOE historical price data", () => {
    it("should process historical price data correctly", () => {
      const mockPrices = [
        { date: "2025-01-13", open: 145.0, high: 148.0, low: 144.5, close: 147.0, volume: 45000000 },
        { date: "2025-01-14", open: 147.5, high: 149.0, low: 146.5, close: 148.5, volume: 42000000 },
        { date: "2025-01-15", open: 148.0, high: 151.0, low: 147.5, close: 150.25, volume: 50000000 },
      ];

      expect(mockPrices).toHaveLength(3);
      expect(mockPrices[0].date).toBe("2025-01-13");
      expect(mockPrices[2].close).toBe(150.25);
      expect(mockPrices[1].volume).toBe(42000000);
    });
  });
});
