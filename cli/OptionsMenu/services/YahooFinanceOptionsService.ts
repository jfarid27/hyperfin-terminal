import { Effect, Context, Layer, Schema } from "effect";
import { ConfigError, HTTPError, ProgramError } from "cli/errors/index.ts";
import { OptionSymbolType, OptionsChain, OptionContract } from "../types.ts";

// ── Yahoo Finance API constants ──

const YAHOO_BASE = "https://query2.finance.yahoo.com";
const YAHOO_FC = "https://fc.yahoo.com";

// ── Raw response schemas ──

const OptionContractRaw = Schema.Struct({
  contractSymbol: Schema.String,
  strike: Schema.Number,
  currency: Schema.String,
  lastPrice: Schema.Number,
  change: Schema.Number,
  percentChange: Schema.Number,
  volume: Schema.NullishOr(Schema.Number),
  openInterest: Schema.Number,
  bid: Schema.Number,
  ask: Schema.Number,
  contractSize: Schema.String,
  expiration: Schema.Number,
  lastTradeDate: Schema.Number,
  impliedVolatility: Schema.Number,
  inTheMoney: Schema.Boolean,
});

const OptionChainResultRaw = Schema.Struct({
  underlyingSymbol: Schema.String,
  expirationDates: Schema.Array(Schema.Number),
  quote: Schema.Struct({
    regularMarketPrice: Schema.optional(Schema.Number),
  }),
  options: Schema.Array(
    Schema.Struct({
      expirationDate: Schema.Number,
      calls: Schema.Array(OptionContractRaw),
      puts: Schema.Array(OptionContractRaw),
    }),
  ),
});

const OptionChainResponseRaw = Schema.Struct({
  optionChain: Schema.Struct({
    result: Schema.Array(OptionChainResultRaw),
  }),
});

// ── Decode helpers ──

const decodeOptionChainResponse = (raw: unknown) =>
  Schema.decodeUnknown(OptionChainResponseRaw)(raw).pipe(
    Effect.catchTag("ParseError", (e) =>
      Effect.logDebug(`Yahoo Finance options response shape changed: ${e.message}`).pipe(
        Effect.andThen(
          Effect.fail(
            new HTTPError({ message: `Invalid Yahoo Finance options response: ${e.message}` }),
          ),
        ),
      ),
    ),
  );

// ── Transform: raw → clean ──

const toOptionContract = (raw: Schema.Schema.Type<typeof OptionContractRaw>): OptionContract => ({
  contractSymbol: raw.contractSymbol,
  strike: raw.strike,
  lastPrice: raw.lastPrice,
  change: raw.change,
  percentChange: raw.percentChange,
  volume: raw.volume ?? 0,
  openInterest: raw.openInterest,
  bid: raw.bid,
  ask: raw.ask,
  impliedVolatility: raw.impliedVolatility,
  inTheMoney: raw.inTheMoney,
  expiration: raw.expiration,
  lastTradeDate: raw.lastTradeDate,
  currency: raw.currency,
  contractSize: raw.contractSize,
});

const toOptionsChain = (
  ticker: string,
  raw: Schema.Schema.Type<typeof OptionChainResultRaw>,
  expirationIndex: number,
): OptionsChain => {
  const opt = raw.options[expirationIndex];
  const expTs = opt.expirationDate;
  return {
    ticker,
    expiration: expTs,
    expirationDate: new Date(expTs * 1000).toISOString().slice(0, 10),
    underlyingPrice: raw.quote.regularMarketPrice ?? 0,
    calls: opt.calls.map(toOptionContract),
    puts: opt.puts.map(toOptionContract),
  };
};

// ── Cookie-aware fetch helper ──
// Yahoo Finance requires a cookie+crumb dance. The FetchService uses native
// fetch which doesn't persist cookies, so we manage the cookie jar manually.

let _cookieHeader: string | null = null;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const yahooFetch = (url: string): Effect.Effect<Response, HTTPError> =>
  Effect.tryPromise({
    try: () =>
      fetch(url, {
        headers: {
          "User-Agent": UA,
          ...(_cookieHeader ? { Cookie: _cookieHeader } : {}),
        },
        redirect: "manual",
      }),
    catch: () => new HTTPError({ message: `Failed to fetch: ${url}` }),
  });

const saveCookies = (response: Response) => {
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    // Extract the A3 cookie value
    const match = setCookie.match(/A3=[^;]+/);
    if (match) {
      _cookieHeader = match[0];
    }
  }
};

const getCrumb = Effect.gen(function* () {
  // Step 1: hit fc.yahoo.com to get a cookie (returns 404, but sets cookie)
  const fcResp = yield* yahooFetch(YAHOO_FC);
  saveCookies(fcResp);

  if (!_cookieHeader) {
    return yield* new HTTPError({ message: "Failed to get Yahoo Finance cookie" });
  }

  // Step 2: get a crumb using the cookie
  const crumbResp = yield* yahooFetch(`${YAHOO_BASE}/v1/test/getcrumb`);
  const crumb = yield* Effect.tryPromise({
    try: () => crumbResp.text(),
    catch: () => new HTTPError({ message: "Failed to read Yahoo crumb response" }),
  });

  if (crumb.includes("<html>") || crumb.includes("Too Many Requests") || crumb === "") {
    return yield* new HTTPError({ message: "Yahoo Finance rate limited or unavailable" });
  }

  return crumb;
});

// ── Service port ──

export interface YahooFinanceOptionsPort {
  readonly getExpirations: (symbol: OptionSymbolType) => Effect.Effect<readonly number[], ProgramError>;
  readonly getChain: (symbol: OptionSymbolType, expiration?: number) => Effect.Effect<OptionsChain, ProgramError>;
}

export class YahooFinanceOptions extends Context.Tag("hyperfin.options.services.YahooFinance")<
  YahooFinanceOptions,
  YahooFinanceOptionsPort
>() {}

// ── Live implementation ──

export const YahooFinanceOptionsLive = Layer.effect(
  YahooFinanceOptions,
  Effect.succeed({
    getExpirations: (symbol: OptionSymbolType) =>
      Effect.gen(function* () {
        const crumb = yield* getCrumb;
        const url = `${YAHOO_BASE}/v7/finance/options/${symbol.id}?crumb=${crumb}`;
        const resp = yield* yahooFetch(url);
        const text = yield* Effect.tryPromise({
          try: () => resp.json(),
          catch: () => new HTTPError({ message: "Failed to parse Yahoo options response" }),
        });
        const validated = yield* decodeOptionChainResponse(text);
        return validated.optionChain.result[0].expirationDates;
      }),

    getChain: (symbol: OptionSymbolType, expiration?: number) =>
      Effect.gen(function* () {
        const crumb = yield* getCrumb;
        const url = expiration
          ? `${YAHOO_BASE}/v7/finance/options/${symbol.id}?date=${expiration}&crumb=${crumb}`
          : `${YAHOO_BASE}/v7/finance/options/${symbol.id}?crumb=${crumb}`;
        const resp = yield* yahooFetch(url);
        const text = yield* Effect.tryPromise({
          try: () => resp.json(),
          catch: () => new HTTPError({ message: "Failed to parse Yahoo options response" }),
        });
        const validated = yield* decodeOptionChainResponse(text);
        const result = validated.optionChain.result[0];
        return toOptionsChain(symbol.name, result, 0);
      }),
  } satisfies YahooFinanceOptionsPort),
);
