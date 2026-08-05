import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { processFredData } from "./fred.ts";

describe("FRED Data Processor", () => {
    describe("processFredData", () => {
        it("should process FRED API observations into formatted data objects", () => {
            const mockFredResponse = {
                observations: [
                    { date: "2020-01-01", value: "100.5" },
                    { date: "2020-01-02", value: "101.2" },
                    { date: "2020-01-03", value: "99.8" }
                ]
            };

            const processed = processFredData(mockFredResponse);

            expect(processed.length,
                "Should have correct number of observations"
            ).toBe(3);

            expect(processed[0].date,
                "First observation date should be correctly extracted"
            ).toBe("2020-01-01");

            expect(processed[0].value,
                "First observation value should be parsed as number"
            ).toBe(100.5);

            expect(processed[0].timestamp,
                "First observation timestamp should be correctly calculated"
            ).toBe(new Date("2020-01-01").getTime());
        });

        it("should sort observations by timestamp in ascending order", () => {
            const mockFredResponse = {
                observations: [
                    { date: "2020-01-03", value: "99.8" },
                    { date: "2020-01-01", value: "100.5" },
                    { date: "2020-01-02", value: "101.2" }
                ]
            };

            const processed = processFredData(mockFredResponse);

            expect(processed[0].date,
                "First item should be earliest date"
            ).toBe("2020-01-01");

            expect(processed[1].date,
                "Second item should be middle date"
            ).toBe("2020-01-02");

            expect(processed[2].date,
                "Third item should be latest date"
            ).toBe("2020-01-03");
        });

        it("should handle missing values by parsing to NaN", () => {
            const mockFredResponse = {
                observations: [
                    { date: "2020-01-01", value: "100.5" },
                    { date: "2020-01-02", value: "." },
                    { date: "2020-01-03", value: "99.8" }
                ]
            };

            const processed = processFredData(mockFredResponse);

            expect(processed.length,
                "Should process all observations including missing values"
            ).toBe(3);

            expect(processed[1].value,
                "Missing value (.) should be parsed to NaN"
            ).toBeNaN();

            expect(processed[0].value,
                "Valid values should be parsed correctly"
            ).toBe(100.5);

            expect(processed[2].value,
                "Valid values should be parsed correctly"
            ).toBe(99.8);
        });

        it("should handle empty observations array", () => {
            const mockFredResponse = {
                observations: []
            };

            const processed = processFredData(mockFredResponse);

            expect(processed.length,
                "Should return empty array for no observations"
            ).toBe(0);
        });

        it("should convert all date strings to millisecond timestamps", () => {
            const mockFredResponse = {
                observations: [
                    { date: "2020-01-01", value: "100" },
                    { date: "2020-12-31", value: "200" }
                ]
            };

            const processed = processFredData(mockFredResponse);

            expect(typeof processed[0].timestamp,
                "Timestamp should be a number"
            ).toBe("number");

            expect(processed[0].timestamp,
                "Timestamp should be in milliseconds"
            ).toBeGreaterThan(0);

            expect(processed[1].timestamp,
                "Later dates should have larger timestamps"
            ).toBeGreaterThan(processed[0].timestamp);
        });
    });
});
