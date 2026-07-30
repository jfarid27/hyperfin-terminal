import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { eventMockData } from "./constants.ts";
import {
    processEventsFromResponse,
} from "./index.ts"

describe("Polymarket Search", () => {

  describe("processMarketsFromResponse transformer", () => {
      
    const result = processEventsFromResponse({ events: [eventMockData] });

    describe("event data", () => {
        describe("header tables", () => {
            it("should return a table with the correct header", () => {
                expect(result[0].tableRow[0])
                .toBe(eventMockData.title);
                expect(result[0].tableRow[1])
                .toBe(eventMockData.slug);
                expect(result[0].tableRow[2])
                .toBe(eventMockData.active);
            });
        });
    });
    
    describe("market data", () => {
        
        describe("header tables", () => {
            it("should return correctly processed header arrays", () => {
                expect(result[0].markets[0].tableRow[0])
                .toBe(eventMockData.markets[0].question);
                expect(result[0].markets[0].tableRow[1])
                .toBe(eventMockData.markets[0].slug);
            });

        });
      
        describe("outcome data", () => {
            it("should return correct outcome data", () => {
                expect(result[0].markets[0].outcomeData[0][0],
                    "Outcome Question should properly be formatted."
                )
                .toBe(eventMockData.markets[0].question);
                expect(result[0].markets[0].outcomeData[0][1][0][0],
                    "Outcome Yes should should be correctly identified."
                )
                .toBe("Yes");
                expect(result[0].markets[0].outcomeData[0][1][0][1],
                    "Outcome Yes price should should be correctly identified."
                )
                .toBe("0.1235");
                expect(result[0].markets[0].outcomeData[0][1][1][0],
                    "Outcome No should should be correctly identified."
                )
                .toBe("No");
                expect(result[0].markets[0].outcomeData[0][1][1][1],
                    "Outcome No price should should be correctly identified."
                )
                .toBe("0.8765");
            });
          
        });
    });
    
    
  });
});