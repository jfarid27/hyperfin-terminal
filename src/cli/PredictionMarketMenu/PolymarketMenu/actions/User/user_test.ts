import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";

import { processUserData, processUserAccountData } from "./index.ts"

const mockUserResponse = [{
    proxyWallet: "0x1abe1368601330a310162064e04d3c2628cb6497",
    asset: "11631590502751337995086584451805403545770829549632613492416833230270784409909",
    conditionId: "0xabb86b080e9858dcb3f46954010e49b6f539c20036856c7f999395bfd58d01e6",
    size: 63802.952936,
    avgPrice: 0.164567,
    initialValue: 10499.860555818712,
    currentValue: 11803.54629316,
    cashPnl: 1303.6857373412877,
    percentPnl: 12.416219533685364,
    totalBought: 63802.952936,
    realizedPnl: 3,
    percentRealizedPnl: 12.416219533685364,
    curPrice: 0.185,
    redeemable: false,
    mergeable: false,
    title: "US strikes Iran by January 31, 2026?",
    slug: "us-strikes-iran-by-january-31-2026",
    icon: "https://polymarket-upload.s3.us-east-2.amazonaws.com/us-strikes-iran-by-october-3-2sVnIHq3sjqF.jpg",
    eventId: "114242",
    eventSlug: "us-strikes-iran-by",
    outcome: "Yes",
    outcomeIndex: 0,
    oppositeOutcome: "No",
    oppositeAsset: "13294549611854156060952327202052855585194847446707854951585060180328600525494",
    endDate: "2026-01-31",
    negativeRisk: false
  },
  {
    proxyWallet: "0x1abe1368601330a310162064e04d3c2628cb6497",
    asset: "114073431155826730926052468626599502581519892859155799641358176120253844422606",
    conditionId: "0x4b02efe53e631ada84681303fd66d79ad615f3d2b6a28b4633d43d935f89af58",
    size: 29724.338558,
    avgPrice: 0.28764,
    initialValue: 8549.90874282312,
    currentValue: 9065.92326019,
    cashPnl: 516.0145173668805,
    percentPnl: 6.035321930190521,
    totalBought: 29724.338558,
    realizedPnl: 1,
    percentRealizedPnl: 6.035321930190521,
    curPrice: 0.305,
    redeemable: false,
    mergeable: false,
    title: "US strikes Iran by March 31, 2026?",
    slug: "us-strikes-iran-by-march-31-2026-393",
    icon: "https://polymarket-upload.s3.us-east-2.amazonaws.com/us-strikes-iran-by-october-3-2sVnIHq3sjqF.jpg",
    eventId: "114242",
    eventSlug: "us-strikes-iran-by",
    outcome: "Yes",
    outcomeIndex: 0,
    oppositeOutcome: "No",
    oppositeAsset: "102493900551645701521693125055452122755587721284263456800351297341161706805154",
    endDate: "2026-06-30",
    negativeRisk: false
  },

];

describe("Polymarket User Data Transformer", () => {
    
    const userData: any[] = processUserData(mockUserResponse);
    const accountData: any = processUserAccountData(mockUserResponse);

    it("Should correctly process user data", () => {

        expect(userData[0].title,
            "Title should be correctly identified"
        ).toBe(mockUserResponse[0].title);

        expect(userData[0].size,
            "Size should be correctly identified"
        ).toBe(mockUserResponse[0].size);

        expect(userData[0].currentValue,
            "curentValue should be correctly identified"
        ).toBe(mockUserResponse[0].currentValue);

        expect(userData[0].slug,
            "slug should be correctly identified"
        ).toBe(mockUserResponse[0].slug);
    });
    
    it("Should correctly process account data", () => {
        expect(accountData.realizedPnl,
            "Realized PnL should sum across all positions"
        ).toBe(4);
        expect(accountData.currentValue,
            "Total Value should sum across all positions"
        ).toBe(mockUserResponse[0].currentValue + mockUserResponse[1].currentValue);
    });
});
