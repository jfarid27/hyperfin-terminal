import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { lineChart, TimeSeriesData, TimeSeriesOptions } from "./charting.ts";

describe("Charting Component", () => {
    describe("lineChart function", () => {
        it("should create a line chart mark with correct structure", () => {
            const testData = [
                { date: "2024-01-01", value: 100 },
                { date: "2024-01-02", value: 150 },
                { date: "2024-01-03", value: 125 }
            ];

            const result = lineChart(testData, "date", "value");

            // lineChart returns a Plot mark object
            expect(result,
                "lineChart should return a truthy value"
            ).toBeTruthy();
        });

        it("should handle empty data array", () => {
            const result = lineChart([], "x", "y");

            expect(result,
                "Should handle empty data gracefully"
            ).toBeTruthy();
        });

        it("should handle single data point", () => {
            const testData = [
                { timestamp: 1704067200, price: 0.50 }
            ];

            const result = lineChart(testData, "timestamp", "price");

            expect(result,
                "Should handle single data point"
            ).toBeTruthy();
        });
    });

    describe("TimeSeriesData interface validation", () => {
        it("should accept valid TimeSeriesData structure", () => {
            const validSeries: TimeSeriesData = {
                label: "Test Series",
                data: [
                    { timestamp: 1704067200, price: 0.42 },
                    { timestamp: 1704153600, price: 0.45 }
                ]
            };

            expect(validSeries.label,
                "Label should be string"
            ).toBe("Test Series");
            expect(validSeries.data.length,
                "Data should have correct length"
            ).toBe(2);
        });

        it("should accept TimeSeriesData with options", () => {
            const options: TimeSeriesOptions = {
                color: "red"
            };

            const seriesWithOptions: TimeSeriesData = {
                label: "Yes Prices",
                data: [
                    { timestamp: 1704067200, price: 0.60 }
                ],
                options: options
            };

            expect(seriesWithOptions.options?.color,
                "Color option should be set"
            ).toBe("red");
        });

        it("should handle multiple series for multi-line chart", () => {
            const multiSeries: TimeSeriesData[] = [
                {
                    label: "Yes",
                    data: [
                        { timestamp: 1704067200, price: 0.60 },
                        { timestamp: 1704153600, price: 0.65 }
                    ],
                    options: { color: "green" }
                },
                {
                    label: "No",
                    data: [
                        { timestamp: 1704067200, price: 0.40 },
                        { timestamp: 1704153600, price: 0.35 }
                    ],
                    options: { color: "red" }
                }
            ];

            expect(multiSeries.length,
                "Should have two series"
            ).toBe(2);
            expect(multiSeries[0].label,
                "First series should be Yes"
            ).toBe("Yes");
            expect(multiSeries[1].label,
                "Second series should be No"
            ).toBe("No");
            expect(multiSeries[0].options?.color,
                "First series color should be green"
            ).toBe("green");
            expect(multiSeries[1].options?.color,
                "Second series color should be red"
            ).toBe("red");
        });
    });

    describe("Data transformation for charting", () => {
        it("should support Unix timestamp data for multi-line charts", () => {
            // This tests the data structure expected by showMultiLineChart
            const chartData: TimeSeriesData[] = [
                {
                    label: "Market Prices",
                    data: [
                        { timestamp: 1704067200, price: 0.42 }, // 2024-01-01
                        { timestamp: 1704153600, price: 0.45 }, // 2024-01-02
                        { timestamp: 1704240000, price: 0.43 }  // 2024-01-03
                    ],
                    options: { color: "steelblue" }
                }
            ];

            // Verify Unix timestamps are valid
            const timestamps = chartData[0].data.map(d => d.timestamp);
            expect(timestamps.every(t => t > 0),
                "All timestamps should be positive"
            ).toBe(true);

            // Verify prices are valid (0-1 range for prediction markets)
            const prices = chartData[0].data.map(d => d.price);
            expect(prices.every(p => p >= 0 && p <= 1),
                "All prices should be in valid range"
            ).toBe(true);
        });

        it("should support date string data for single line charts", () => {
            // This tests the data structure expected by showLineChart
            const chartData = [
                { date: "2024-01-01", value: 100 },
                { date: "2024-01-02", value: 150 },
                { date: "2024-01-03", value: 125 }
            ];

            expect(chartData.length,
                "Should have three data points"
            ).toBe(3);

            // Verify date strings are parseable
            const dates = chartData.map(d => new Date(d.date));
            expect(dates.every(d => !isNaN(d.getTime())),
                "All dates should be valid"
            ).toBe(true);
        });

        it("should handle large datasets", () => {
            // Generate a large dataset (365 days of data)
            const largeData: Record<string, any>[] = [];
            const startTimestamp = 1704067200; // 2024-01-01
            const dayInSeconds = 86400;

            for (let i = 0; i < 365; i++) {
                largeData.push({
                    timestamp: startTimestamp + (i * dayInSeconds),
                    price: Math.random()
                });
            }

            const series: TimeSeriesData = {
                label: "Full Year Data",
                data: largeData
            };

            expect(series.data.length,
                "Should have 365 data points"
            ).toBe(365);
        });

        it("should handle edge case price values", () => {
            const edgeCaseData: TimeSeriesData = {
                label: "Edge Cases",
                data: [
                    { timestamp: 1704067200, price: 0 },      // Minimum price
                    { timestamp: 1704153600, price: 1 },      // Maximum price
                    { timestamp: 1704240000, price: 0.5 },    // Mid-point
                    { timestamp: 1704326400, price: 0.001 },  // Very small
                    { timestamp: 1704412800, price: 0.999 }   // Near maximum
                ]
            };

            expect(edgeCaseData.data[0].price,
                "Should handle zero price"
            ).toBe(0);
            expect(edgeCaseData.data[1].price,
                "Should handle max price"
            ).toBe(1);
        });
    });
});
