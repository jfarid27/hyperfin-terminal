import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { mockMarketData } from "./constants.ts";
import {
    processMarketSlugDataResponse,
    processMarketPriceHistory,
    outcomePricesMapper,
    zipEventOutcomePrices
} from "./index.ts"

describe("Polymarket Market Data Transformer", () => {
    const { marketData, outcomeData } = processMarketSlugDataResponse(mockMarketData);
    const outcomePoint = outcomeData[0];
    const outcomes = outcomePoint[1];

    describe("Outcome Data", () => {
        it("should return the correct outcome data", () => {
            expect(outcomePoint[0],
                "Outcome Question should be correctly identified."
            ).toBe(mockMarketData.question);
            expect(outcomes[0][0],
                "Outcome Yes should be correctly identified."
            ).toBe("Yes");
            expect(outcomes[0][1],
                "Outcome Yes price should be correctly identified."
            ).toBe("0.42");
            expect(outcomes[1][0],
                "Outcome No should be correctly identified."
            ).toBe("No");
            expect(outcomes[1][1],
                "Outcome No price should be correctly identified."
            ).toBe("0.58");
        });
    });

    describe("Market Data", () => {
        it("should return the correct market data", () => {
            expect(marketData[0],
                "Active should be correctly identified"
            ).toBe(mockMarketData.active);

            expect(marketData[1],
                "Liquidity should be correctly identified"
            ).toBe(mockMarketData.liquidityNum);

            expect(marketData[2],
                "Volume should be correctly identified"
            ).toBe(mockMarketData.volumeNum);
        });
    });

    describe("Price History Processing", () => {
        it("should process price history correctly with timestamp and price fields", () => {
            const mockPriceHistory = {
                history: [
                    { t: 1704067200, p: 0.42 },
                    { t: 1704153600, p: 0.45 },
                    { t: 1704240000, p: 0.43 }
                ]
            };

            const processed = processMarketPriceHistory(mockPriceHistory);

            expect(processed.length,
                "Should have correct number of price points"
            ).toBe(3);

            expect(processed[0].timestamp,
                "First timestamp should be correctly extracted"
            ).toBe(1704067200);

            expect(processed[0].price,
                "First price should be correctly extracted"
            ).toBe(0.42);

            expect(processed[1].timestamp,
                "Second timestamp should be correctly extracted"
            ).toBe(1704153600);

            expect(processed[1].price,
                "Second price should be correctly extracted"
            ).toBe(0.45);
        });
    });
});

describe("Polymarket Market Data Edge Cases", () => {
    describe("outcomePricesMapper", () => {
        it("should parse valid JSON array of outcomes", () => {
            const result = outcomePricesMapper('["Yes", "No"]');
            expect(result.length,
                "Should parse two outcomes"
            ).toBe(2);
            expect(result[0],
                "First outcome should be Yes"
            ).toBe("Yes");
            expect(result[1],
                "Second outcome should be No"
            ).toBe("No");
        });

        it("should parse valid JSON array of prices", () => {
            const result = outcomePricesMapper('["0.55", "0.45"]');
            expect(result.length,
                "Should parse two prices"
            ).toBe(2);
            expect(result[0],
                "First price should be 0.55"
            ).toBe("0.55");
            expect(result[1],
                "Second price should be 0.45"
            ).toBe("0.45");
        });

        it("should handle invalid JSON with NA fallback", () => {
            const result = outcomePricesMapper('invalid json');
            expect(result.length,
                "Should return single NA element"
            ).toBe(1);
            expect(result[0],
                "Should contain NA"
            ).toBe("NA");
        });

        it("should handle empty string with NA fallback", () => {
            const result = outcomePricesMapper('');
            expect(result[0],
                "Empty string should return NA"
            ).toBe("NA");
        });

        it("should handle malformed JSON with NA fallback", () => {
            const result = outcomePricesMapper('["unclosed');
            expect(result[0],
                "Malformed JSON should return NA"
            ).toBe("NA");
        });
    });

    describe("zipEventOutcomePrices", () => {
        it("should zip outcomes and prices correctly", () => {
            const mockEvent = {
                outcomes: '["Yes", "No"]',
                outcomePrices: '["0.60", "0.40"]'
            };

            const result = zipEventOutcomePrices(mockEvent);

            expect(result.length,
                "Should have two zipped pairs"
            ).toBe(2);
            expect(result[0][0],
                "First pair outcome should be Yes"
            ).toBe("Yes");
            expect(result[0][1],
                "First pair price should be 0.60"
            ).toBe("0.60");
            expect(result[1][0],
                "Second pair outcome should be No"
            ).toBe("No");
            expect(result[1][1],
                "Second pair price should be 0.40"
            ).toBe("0.40");
        });

        it("should handle multi-outcome markets", () => {
            const mockEvent = {
                outcomes: '["Option A", "Option B", "Option C"]',
                outcomePrices: '["0.33", "0.34", "0.33"]'
            };

            const result = zipEventOutcomePrices(mockEvent);

            expect(result.length,
                "Should have three zipped pairs"
            ).toBe(3);
            expect(result[2][0],
                "Third option should be Option C"
            ).toBe("Option C");
            expect(result[2][1],
                "Third price should be 0.33"
            ).toBe("0.33");
        });

        it("should handle invalid outcomes gracefully", () => {
            const mockEvent = {
                outcomes: 'invalid',
                outcomePrices: '["0.50", "0.50"]'
            };

            const result = zipEventOutcomePrices(mockEvent);

            expect(result.length,
                "Should handle mismatched arrays"
            ).toBe(1);
        });
    });

    describe("Price History Edge Cases", () => {
        it("should handle empty history array", () => {
            const mockPriceHistory = {
                history: []
            };

            const processed = processMarketPriceHistory(mockPriceHistory);

            expect(processed.length,
                "Empty history should return empty array"
            ).toBe(0);
        });

        it("should handle single price point", () => {
            const mockPriceHistory = {
                history: [
                    { t: 1704067200, p: 0.50 }
                ]
            };

            const processed = processMarketPriceHistory(mockPriceHistory);

            expect(processed.length,
                "Should have single price point"
            ).toBe(1);
            expect(processed[0].timestamp,
                "Timestamp should be correctly extracted"
            ).toBe(1704067200);
            expect(processed[0].price,
                "Price should be correctly extracted"
            ).toBe(0.50);
        });

        it("should handle price values at boundaries", () => {
            const mockPriceHistory = {
                history: [
                    { t: 1704067200, p: 0 },
                    { t: 1704153600, p: 1 },
                    { t: 1704240000, p: 0.99 }
                ]
            };

            const processed = processMarketPriceHistory(mockPriceHistory);

            expect(processed[0].price,
                "Should handle price of 0"
            ).toBe(0);
            expect(processed[1].price,
                "Should handle price of 1"
            ).toBe(1);
            expect(processed[2].price,
                "Should handle price of 0.99"
            ).toBe(0.99);
        });

        it("should preserve chronological order", () => {
            const mockPriceHistory = {
                history: [
                    { t: 1704067200, p: 0.42 },
                    { t: 1704153600, p: 0.45 },
                    { t: 1704240000, p: 0.43 },
                    { t: 1704326400, p: 0.48 }
                ]
            };

            const processed = processMarketPriceHistory(mockPriceHistory);

            expect(processed[0].timestamp < processed[1].timestamp,
                "Timestamps should be in order"
            ).toBe(true);
            expect(processed[2].timestamp < processed[3].timestamp,
                "Later timestamps should follow"
            ).toBe(true);
        });
    });

    describe("Market Slug Response Edge Cases", () => {
        it("should handle market with zero liquidity", () => {
            const marketWithZeroLiquidity = {
                ...mockMarketData,
                liquidityNum: 0,
                volumeNum: 0,
                active: false
            };

            const { marketData } = processMarketSlugDataResponse(marketWithZeroLiquidity);

            expect(marketData[0],
                "Inactive status should be captured"
            ).toBe(false);
            expect(marketData[1],
                "Zero liquidity should be captured"
            ).toBe(0);
            expect(marketData[2],
                "Zero volume should be captured"
            ).toBe(0);
        });

        it("should handle market with high precision numbers", () => {
            const marketWithPrecision = {
                ...mockMarketData,
                liquidityNum: 123456.789012,
                volumeNum: 9876543.210987
            };

            const { marketData } = processMarketSlugDataResponse(marketWithPrecision);

            expect(marketData[1],
                "High precision liquidity should be preserved"
            ).toBe(123456.789012);
            expect(marketData[2],
                "High precision volume should be preserved"
            ).toBe(9876543.210987);
        });
    });
});
