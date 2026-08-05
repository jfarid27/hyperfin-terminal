import { expect } from "jsr:@std/expect";

import {
    processOutcomeData
} from './polymarket.ts'

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

