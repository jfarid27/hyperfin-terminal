/**
 * Market sentiment actions: Fear & Greed and the Altcoin Season index.
 *
 * Both are CoinMarketCap endpoints, so both need `CMC_API_KEY`. The key guard is
 * tested against the real layer (with a fetch stub that fails if it is ever
 * called) rather than a mock, because "requires a key" is the behaviour the
 * user sees, not an implementation detail.
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect, Layer } from "effect";
import {
  CoinMarketCapSentimentModel,
  CoinMarketCapSentimentModelLive,
} from "../model/index.ts";
import { toAltcoinSeasonIndex, toFearGreedIndex } from "../model/CoinMarketCapSentimentApi.ts";
import { FetchService } from "../../services/FetchService.ts";
import { ConfigError, HTTPError } from "../../errors/index.ts";
import {
  CommandResultType,
  DataSourceType,
  EnvironmentType,
  LogLevel,
  TerminalUserStateConfigContext,
} from "../../types.ts";
import type { TerminalUserStateConfig } from "../../types.ts";
import { altcoinSeasonHandler, fearGreedHandler } from "./sentiment.ts";

// ── Fixtures (real payloads, trimmed to the fields the extractors read) ──

const fearGreedPayload = {
  value: 55,
  update_time: "2026-10-13T17:23:10.029Z",
  value_classification: "Neutral",
};

const altcoinSeasonPayload = {
  altcoin_index: 59,
  altcoin_marketcap: 1123301826557.15,
  snapshot_time: "2026-10-13T17:15:02Z",
  yearly_high: 64,
  yearly_high_date: "2026-09-27",
  yearly_low: 14,
  yearly_low_date: "2025-12-19",
};

const baseState: TerminalUserStateConfig = {
  environment: EnvironmentType.Development,
  logLevel: LogLevel.None,
  sessionPath: "",
  apiKeys: {
    coingecko: undefined,
    alphavantage: undefined,
    blockchaincom: undefined,
    freecryptoapi: undefined,
    fred: undefined,
    massive: undefined,
    yahoofinance: undefined,
    alpaca: undefined,
    coinmarketcap: "test-key",
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
  },
  scriptContext: {},
};

// ── Mock layers ──

const mockSentiment = (fearGreed = fearGreedPayload, altcoin = altcoinSeasonPayload) =>
  Layer.succeed(CoinMarketCapSentimentModel, {
    fearGreed: { get: (_apiKey) => Effect.succeed(toFearGreedIndex(fearGreed)!) },
    altcoinSeason: { get: (_apiKey) => Effect.succeed(toAltcoinSeasonIndex(altcoin)!) },
  });

const mockState = (overrides?: Partial<TerminalUserStateConfig>) =>
  Layer.succeed(TerminalUserStateConfigContext, { ...baseState, ...overrides });

/** A fetch stub that fails loudly: nothing here should ever reach the network. */
const explodingFetch: Layer.Layer<FetchService> = Layer.succeed(FetchService, {
  fetch: () => Effect.fail(new HTTPError({ message: "the network must not be called" })),
  fetchJson: () => Effect.fail(new HTTPError({ message: "the network must not be called" })),
});

// ── Tests ──

describe("sentiment payload extraction", () => {
  it("reads the Fear & Greed value with CoinMarketCap's own label", () => {
    const index = toFearGreedIndex(fearGreedPayload);

    expect(index).not.toBe(null);
    expect(index!.value).toBe(55);
    expect(index!.classification).toBe("Neutral");
    expect(index!.updatedAt).toBe("2026-10-13T17:23:10.029Z");
  });

  it("labels an unclassified reading rather than printing nothing", () => {
    expect(toFearGreedIndex({ value: 12 })!.classification).toBe("Unclassified");
  });

  it("returns null when the payload carries no value", () => {
    expect(toFearGreedIndex({})).toBe(null);
    expect(toFearGreedIndex(undefined)).toBe(null);
  });

  it("reads the Altcoin Season index with its yearly range", () => {
    const index = toAltcoinSeasonIndex(altcoinSeasonPayload);

    expect(index).not.toBe(null);
    expect(index!.index).toBe(59);
    expect(index!.marketCapUsd).toBeCloseTo(1123301826557.15, 2);
    expect(index!.yearlyHigh).toBe(64);
    expect(index!.yearlyHighDate).toBe("2026-09-27");
    expect(index!.yearlyLow).toBe(14);
    expect(index!.yearlyLowDate).toBe("2025-12-19");
  });

  it("returns null when the payload carries no index", () => {
    expect(toAltcoinSeasonIndex({})).toBe(null);
    expect(toAltcoinSeasonIndex(undefined)).toBe(null);
  });
});

describe("fearGreedHandler", () => {
  it("succeeds on a reading", async () => {
    const result = await Effect.runPromise(
      fearGreedHandler().pipe(
        Effect.provide(mockSentiment()),
        Effect.provide(mockState()),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
  });

  it("propagates a model failure as ProgramError", async () => {
    const failing = Layer.succeed(CoinMarketCapSentimentModel, {
      fearGreed: { get: () => Effect.fail(new ConfigError({ message: "no key" })) },
      altcoinSeason: { get: () => Effect.fail(new ConfigError({ message: "no key" })) },
    });

    await expect(
      Effect.runPromise(
        fearGreedHandler().pipe(
          Effect.provide(failing),
          Effect.provide(mockState()),
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("altcoinSeasonHandler", () => {
  it("succeeds on a reading", async () => {
    const result = await Effect.runPromise(
      altcoinSeasonHandler().pipe(
        Effect.provide(mockSentiment()),
        Effect.provide(mockState()),
      ),
    );

    expect(result.result.type).toBe(CommandResultType.Success);
  });
});

describe("the live model requires an API key", () => {
  it("fails with ConfigError, without touching the network, when no key is set", async () => {
    const program = Effect.gen(function* () {
      const model = yield* CoinMarketCapSentimentModel;
      return yield* model.fearGreed.get(undefined);
    }).pipe(
      Effect.provide(CoinMarketCapSentimentModelLive),
      Effect.provide(explodingFetch),
    );

    await expect(Effect.runPromise(program)).rejects.toThrow(/API key/i);
  });

  it("fails the same way for the altcoin season index", async () => {
    const program = Effect.gen(function* () {
      const model = yield* CoinMarketCapSentimentModel;
      return yield* model.altcoinSeason.get("");
    }).pipe(
      Effect.provide(CoinMarketCapSentimentModelLive),
      Effect.provide(explodingFetch),
    );

    await expect(Effect.runPromise(program)).rejects.toThrow(/API key/i);
  });
});
