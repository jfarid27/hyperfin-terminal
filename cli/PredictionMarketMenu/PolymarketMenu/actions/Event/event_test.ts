import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { eventMockData } from "./constants.ts";
import { processEventDataBySlug } from "./index.ts"

describe("Polymarket Event Data Transformer", () => {
    const { marketData, outcomeData } = processEventDataBySlug(eventMockData); 
    const outcomePoint = outcomeData[0];
    const outcomes = outcomePoint[1];
    
    describe("Market Data", () => {
        it("should return the correct market data", () => {
            
            expect(marketData[0],
                "Slug should be correctly identified"
            ).toBe(eventMockData.slug);

            expect(marketData[1],
                "Active should be correctly identified"
            ).toBe(eventMockData.active);

            expect(marketData[2],
                "Liquidity should be correctly identified"
            ).toBe(eventMockData.liquidity);

            expect(marketData[3],
                "Volume should be correctly identified"
            ).toBe(eventMockData.volume);

            expect(marketData[4],
                "Competitive should be correctly identified"
            ).toBe(eventMockData.competitive);
        
        });
    });
    
    describe("Markets By Outcome Data", () => {
        it("should return the correct outcome data", () => {
            
            // Market question
            expect(outcomePoint[0],
                "Outcome Question should be correctly identified."
            ).toBe(eventMockData.markets[0].question);
            
            // Yes outcome
            expect(outcomes[0][0],
                "Outcome Yes should be correctly identified."
            ).toBe("Yes");
            expect(outcomes[0][1],
                "Outcome Yes price should be correctly identified."
            ).toBe("0.1235");
            
            // No outcome
            expect(outcomes[1][0],
                "Outcome No should be correctly identified."
            ).toBe("No");
            expect(outcomes[1][1],
                "Outcome No price should be correctly identified."
            ).toBe("0.8765");
        });
    });
});