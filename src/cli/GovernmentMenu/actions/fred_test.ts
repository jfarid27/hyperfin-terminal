import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { processFredData, stripHtml, toSeriesSummaries } from "./fred.ts";

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

// ── FRED series search fixtures (from curl against "treasury yield", 2026-10-07) ──

const searchRaw = {
    realtime_start: "2026-10-07",
    realtime_end: "2026-10-07",
    count: 632,
    seriess: [
        {
            id: "DGS10",
            title: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity",
            observation_start: "1962-01-02",
            observation_end: "2026-10-05",
            frequency: "Daily",
            units: "Percent",
            notes: "H.15 Statistical Release (https://www.federalreserve.gov/releases/h15/current/h15.pdf) notes<p>For questions on the data, please contact the data source.</p>",
        },
        {
            id: "GS10",
            title: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity",
            observation_start: "1953-04-01",
            observation_end: "2026-09-01",
            frequency: "Monthly",
            units: "Percent",
            notes: "",
        },
    ],
};

describe("stripHtml", () => {
    it("removes tags and collapses whitespace", () => {
        expect(stripHtml("<p>Hello</p>  <b>world</b>"))
            .toBe("Hello world");
    });

    it("decodes common entities", () => {
        expect(stripHtml("A &amp; B &lt;x&gt; &quot;q&quot; &#39;s&#39;"))
            .toBe('A & B <x> "q" \'s\'');
    });

    it("returns an empty string for empty input", () => {
        expect(stripHtml("")).toBe("");
    });
});

describe("toSeriesSummaries", () => {
    it("maps a raw FRED series/search response into summaries", () => {
        const summaries = toSeriesSummaries(searchRaw);

        expect(summaries.length).toBe(2);
        expect(summaries[0].id).toBe("DGS10");
        expect(summaries[0].title)
            .toBe("Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity");
        expect(summaries[0].frequency).toBe("Daily");
        expect(summaries[0].units).toBe("Percent");
        expect(summaries[0].observationStart).toBe("1962-01-02");
        expect(summaries[0].observationEnd).toBe("2026-10-05");
    });

    it("strips HTML from the notes field into a plain description", () => {
        const summaries = toSeriesSummaries(searchRaw);
        expect(summaries[0].description.includes("<p>"),
            "HTML tags must not survive into the description"
        ).toBe(false);
        expect(summaries[0].description.includes("H.15 Statistical Release")).toBe(true);
    });

    it("returns an empty list when there are no matches", () => {
        expect(toSeriesSummaries({ count: 0, seriess: [] }).length).toBe(0);
    });

    it("survives a response missing the seriess key", () => {
        expect(toSeriesSummaries({}).length).toBe(0);
    });
});
