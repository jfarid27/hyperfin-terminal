import { expect } from "jsr:@std/expect";

import {
    processOutcomeData,
    marketLinkRows,
    topMarketLinkRows,
} from './polymarket.ts'
import { stripOsc } from '../../../utils/links.ts'

// A mock response from the Polymarket API for a single market.
const mockResponse = {
  question: "U.S. forces seize another Venezuela-linked oil ship by January 16, 2026?",
  conditionId: "0x7299739226853e183345f104a0af9c410534ed862dd9100c7b1c00ecafc5d67a",
  slug: "us-forces-seize-another-venezuela-linked-oil-ship-by-january-16-2026-447-517",
  resolutionSource: "",
  endDate: "2026-01-16T00:00:00Z",
  startDate: "2025-12-26T19:41:27.394806Z",
  image: "https://polymarket-upload.s3.us-east-2.amazonaws.com/us-forces-seize-another-venezuela-linked-oil-ship-in-2025-52ZgdVw45IgB.jpg",
  icon: "https://polymarket-upload.s3.us-east-2.amazonaws.com/us-forces-seize-another-venezuela-linked-oil-ship-in-2025-52ZgdVw45IgB.jpg",
  description: "This market will resolve to “Yes” if U.S. government forces seize another ship that is transporting, or is intended to transport, oil to or from Venezuela by the specified date, 11:59 PM ET. Otherwise, this market will resolve to “No”.\n" +
    "\n" +
    "U.S. government forces refers to any active U.S. military (including U.S. Coast Guard), law enforcement, or intelligence personnel or contractors.\n" +
    "\n" +
    "Seizes refers to U.S. forces taking custody of or asserting operational control of the vessel, including boarding and taking control of the vessel, detaining the vessel indefinitely, or forcefully rerouting the vessel to a U.S.-controlled port.\n" +
    "\n" +
    "The resolution source for this market will be a consensus of credible reporting.",
  outcomes: '["Yes", "No"]',
  outcomePrices: '["1", "0"]',
  active: true,
  closed: true
};

const mockOutcomeData = [ [ "Yes", "1" ], [ "No", "0" ] ];

Deno.test("Polymarket Action: ProcessOutcomeData", () => {
    const outcomes = processOutcomeData([mockResponse]);
    
    // The processing function returns an array of [question, outcomes]
    const resultOutcomes = outcomes[0][1]; 
    
    expect(outcomes[0][0]).toEqual(mockResponse.question);
    

    // Check the resulting outcomes pairs.
    expect(resultOutcomes[0][0]).toEqual(mockOutcomeData[0][0]);
    expect(resultOutcomes[0][1]).toEqual(mockOutcomeData[0][1]);
    expect(resultOutcomes[1][0]).toEqual(mockOutcomeData[1][0]);
    expect(resultOutcomes[1][1]).toEqual(mockOutcomeData[1][1]);
})

// A market as the `/markets` endpoint returns one, `events` array included.
const mockMarketRow = {
    slug: "will-the-cardinals-win-the-2027-nfl-league-championship",
    question: "Will the Arizona Cardinals win the 2027 NFL league championship?",
    outcomes: '["Yes", "No"]',
    outcomePrices: '["0.03", "0.97"]',
    volume: 1200,
    liquidity: 340,
    events: [{ slug: "pro-football-2027-champion-20260729185915366" }],
};

const CARDINALS_URL =
    "https://polymarket.com/event/pro-football-2027-champion-20260729185915366/will-the-cardinals-win-the-2027-nfl-league-championship";

Deno.test("Polymarket Action: `markets` rows end in the market's link", () => {
    const [row] = marketLinkRows([mockMarketRow]);

    expect(row.length).toBe(4);
    expect(row[0]).toBe(mockMarketRow.slug);
    expect(stripOsc(row[3])).toBe(CARDINALS_URL);
});

Deno.test("Polymarket Action: `top` rows carry question, slug, information and link", () => {
    const [row] = topMarketLinkRows([mockMarketRow], "cardinals");

    expect(row[0]).toBe(mockMarketRow.question);
    expect(row[1]).toBe(mockMarketRow.slug);
    expect(row[2]).toContain("Volume: 1200");
    expect(stripOsc(row[3])).toBe(CARDINALS_URL);
});

Deno.test("Polymarket Action: `top` still filters on the question", () => {
    expect(topMarketLinkRows([mockMarketRow], "nothing matches").length).toBe(0);
    expect(topMarketLinkRows([mockMarketRow]).length).toBe(1);
    expect(topMarketLinkRows([mockMarketRow], "CARDINALS").length).toBe(1);
});

Deno.test("Polymarket Action: a market with no events array still gets a link", () => {
    const { events: _events, ...withoutEvents } = mockMarketRow;
    const [row] = marketLinkRows([withoutEvents]);

    expect(stripOsc(row[3])).toBe(
        `https://polymarket.com/market/${mockMarketRow.slug}`,
    );
});

