import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { eventMockData } from "./constants.ts";
import { processMarketsData } from "./index.ts"

describe("Kalshi Event Data Transformer", () => {
    const processedMarkets = processMarketsData(eventMockData.markets);
    const firstMarket = processedMarkets[0];
    const secondMarket = processedMarkets[1];

    describe("Market Summary Data", () => {
        it("should extract correct summary data for first market", () => {
            expect(firstMarket.summary.title,
                "Title should be correctly extracted"
            ).toBe(eventMockData.markets[0].title);

            expect(firstMarket.summary.subtitle,
                "Subtitle should be correctly extracted"
            ).toBe(eventMockData.markets[0].subtitle);

            expect(firstMarket.summary.volume,
                "Volume should be correctly extracted"
            ).toBe(eventMockData.markets[0].volume);

            expect(firstMarket.summary.volume_24h,
                "Volume 24h should be correctly extracted"
            ).toBe(eventMockData.markets[0].volume_24h);

            expect(firstMarket.summary.liquidity,
                "Liquidity should be correctly extracted"
            ).toBe(eventMockData.markets[0].liquidity);

            expect(firstMarket.summary.liquidity_dollars,
                "Liquidity in dollars should be correctly extracted"
            ).toBe(eventMockData.markets[0].liquidity_dollars);
        });

        it("should extract correct summary data for second market", () => {
            expect(secondMarket.summary.title,
                "Title should be correctly extracted"
            ).toBe(eventMockData.markets[1].title);

            expect(secondMarket.summary.volume,
                "Volume should be correctly extracted"
            ).toBe(eventMockData.markets[1].volume);
        });
    });

    describe("Bid/Ask Data with Spreads", () => {
        it("should correctly compute Yes option bid/ask/spread for first market", () => {
            expect(firstMarket.bidAsk.yes.bid,
                "Yes bid should be correctly extracted"
            ).toBe("0.15");

            expect(firstMarket.bidAsk.yes.ask,
                "Yes ask should be correctly extracted"
            ).toBe("0.18");

            expect(firstMarket.bidAsk.yes.spread,
                "Yes spread should be correctly computed"
            ).toBe("0.0300");
        });

        it("should correctly compute No option bid/ask/spread for first market", () => {
            expect(firstMarket.bidAsk.no.bid,
                "No bid should be correctly extracted"
            ).toBe("0.82");

            expect(firstMarket.bidAsk.no.ask,
                "No ask should be correctly extracted"
            ).toBe("0.85");

            expect(firstMarket.bidAsk.no.spread,
                "No spread should be correctly computed"
            ).toBe("0.0300");
        });

        it("should correctly compute Yes option bid/ask/spread for second market", () => {
            expect(secondMarket.bidAsk.yes.bid,
                "Yes bid should be correctly extracted"
            ).toBe("0.05");

            expect(secondMarket.bidAsk.yes.ask,
                "Yes ask should be correctly extracted"
            ).toBe("0.08");

            expect(secondMarket.bidAsk.yes.spread,
                "Yes spread should be correctly computed"
            ).toBe("0.0300");
        });
    });

    describe("Price Range Data", () => {
        it("should extract correct price range for first market", () => {
            expect(firstMarket.priceRange.start,
                "Price range start should be correctly extracted"
            ).toBe("0.01");

            expect(firstMarket.priceRange.end,
                "Price range end should be correctly extracted"
            ).toBe("0.99");
        });

        it("should extract correct price range for second market", () => {
            expect(secondMarket.priceRange.start,
                "Price range start should be correctly extracted"
            ).toBe("0.01");

            expect(secondMarket.priceRange.end,
                "Price range end should be correctly extracted"
            ).toBe("0.99");
        });
    });

    describe("Multiple Markets Processing", () => {
        it("should process both markets from the response", () => {
            expect(processedMarkets.length,
                "Should process both markets"
            ).toBe(2);
        });
    });
});

describe("Kalshi Event Data Edge Cases", () => {
    describe("Empty Markets Array", () => {
        it("should return empty array when given empty markets array", () => {
            const result = processMarketsData([]);
            expect(result.length,
                "Should return empty array"
            ).toBe(0);
        });
    });

    describe("Missing Bid/Ask Data", () => {
        it("should handle missing yes_bid_dollars with N/A", () => {
            const marketWithMissingData = [{
                title: "Test Market",
                subtitle: "Test",
                volume: 1000,
                volume_24h: 100,
                liquidity: 500,
                liquidity_dollars: "5.00",
                // Missing yes_bid_dollars
                yes_ask_dollars: "0.50",
                no_bid_dollars: "0.50",
                no_ask_dollars: "0.55",
                price_ranges: [{ start: "0.01", end: "0.99" }]
            }];

            const result = processMarketsData(marketWithMissingData);

            expect(result[0].bidAsk.yes.bid,
                "Missing bid should default to N/A"
            ).toBe("N/A");

            expect(result[0].bidAsk.yes.spread,
                "Spread should be N/A when bid is missing"
            ).toBe("N/A");
        });

        it("should handle missing yes_ask_dollars with N/A", () => {
            const marketWithMissingData = [{
                title: "Test Market",
                subtitle: "Test",
                volume: 1000,
                volume_24h: 100,
                liquidity: 500,
                liquidity_dollars: "5.00",
                yes_bid_dollars: "0.45",
                // Missing yes_ask_dollars
                no_bid_dollars: "0.50",
                no_ask_dollars: "0.55",
                price_ranges: [{ start: "0.01", end: "0.99" }]
            }];

            const result = processMarketsData(marketWithMissingData);

            expect(result[0].bidAsk.yes.ask,
                "Missing ask should default to N/A"
            ).toBe("N/A");

            expect(result[0].bidAsk.yes.spread,
                "Spread should be N/A when ask is missing"
            ).toBe("N/A");
        });

        it("should handle all missing bid/ask data gracefully", () => {
            const marketWithNoData = [{
                title: "Test Market",
                subtitle: "Test",
                volume: 1000,
                volume_24h: 100,
                liquidity: 500,
                liquidity_dollars: "5.00",
                price_ranges: [{ start: "0.01", end: "0.99" }]
            }];

            const result = processMarketsData(marketWithNoData);

            expect(result[0].bidAsk.yes.bid,
                "Missing yes bid should be N/A"
            ).toBe("N/A");
            expect(result[0].bidAsk.yes.ask,
                "Missing yes ask should be N/A"
            ).toBe("N/A");
            expect(result[0].bidAsk.yes.spread,
                "Yes spread should be N/A"
            ).toBe("N/A");
            expect(result[0].bidAsk.no.bid,
                "Missing no bid should be N/A"
            ).toBe("N/A");
            expect(result[0].bidAsk.no.ask,
                "Missing no ask should be N/A"
            ).toBe("N/A");
            expect(result[0].bidAsk.no.spread,
                "No spread should be N/A"
            ).toBe("N/A");
        });
    });

    describe("Invalid Bid/Ask Values", () => {
        it("should handle non-numeric bid/ask values", () => {
            const marketWithInvalidData = [{
                title: "Test Market",
                subtitle: "Test",
                volume: 1000,
                volume_24h: 100,
                liquidity: 500,
                liquidity_dollars: "5.00",
                yes_bid_dollars: "invalid",
                yes_ask_dollars: "0.50",
                no_bid_dollars: "0.50",
                no_ask_dollars: "not_a_number",
                price_ranges: [{ start: "0.01", end: "0.99" }]
            }];

            const result = processMarketsData(marketWithInvalidData);

            expect(result[0].bidAsk.yes.spread,
                "Spread should be N/A when bid is invalid"
            ).toBe("N/A");

            expect(result[0].bidAsk.no.spread,
                "Spread should be N/A when ask is invalid"
            ).toBe("N/A");
        });
    });

    describe("Missing Price Range", () => {
        it("should handle missing price_ranges with N/A", () => {
            const marketWithNoPriceRange = [{
                title: "Test Market",
                subtitle: "Test",
                volume: 1000,
                volume_24h: 100,
                liquidity: 500,
                liquidity_dollars: "5.00",
                yes_bid_dollars: "0.45",
                yes_ask_dollars: "0.50",
                no_bid_dollars: "0.50",
                no_ask_dollars: "0.55",
                // No price_ranges
            }];

            const result = processMarketsData(marketWithNoPriceRange);

            expect(result[0].priceRange.start,
                "Missing price range start should be N/A"
            ).toBe("N/A");

            expect(result[0].priceRange.end,
                "Missing price range end should be N/A"
            ).toBe("N/A");
        });

        it("should handle empty price_ranges array with N/A", () => {
            const marketWithEmptyPriceRange = [{
                title: "Test Market",
                subtitle: "Test",
                volume: 1000,
                volume_24h: 100,
                liquidity: 500,
                liquidity_dollars: "5.00",
                yes_bid_dollars: "0.45",
                yes_ask_dollars: "0.50",
                no_bid_dollars: "0.50",
                no_ask_dollars: "0.55",
                price_ranges: []
            }];

            const result = processMarketsData(marketWithEmptyPriceRange);

            expect(result[0].priceRange.start,
                "Empty price range start should be N/A"
            ).toBe("N/A");

            expect(result[0].priceRange.end,
                "Empty price range end should be N/A"
            ).toBe("N/A");
        });
    });

    describe("Spread Precision", () => {
        it("should compute spread with 4 decimal precision", () => {
            const marketWithPreciseValues = [{
                title: "Test Market",
                subtitle: "Test",
                volume: 1000,
                volume_24h: 100,
                liquidity: 500,
                liquidity_dollars: "5.00",
                yes_bid_dollars: "0.123",
                yes_ask_dollars: "0.456",
                no_bid_dollars: "0.544",
                no_ask_dollars: "0.877",
                price_ranges: [{ start: "0.01", end: "0.99" }]
            }];

            const result = processMarketsData(marketWithPreciseValues);

            expect(result[0].bidAsk.yes.spread,
                "Yes spread should have 4 decimal places"
            ).toBe("0.3330");

            expect(result[0].bidAsk.no.spread,
                "No spread should have 4 decimal places"
            ).toBe("0.3330");
        });
    });
});
