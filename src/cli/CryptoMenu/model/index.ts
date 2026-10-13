import { Layer } from "effect";
import { CoinGeckoModelLive } from "./CoinGeckoApi.ts";
import { FreeCryptoAPIModelLive } from "./FreeCryptoAPIApi.ts";
import { CoinMarketCapDexModelLive } from "./CoinMarketCapDexApi.ts";
import { CoinMarketCapSentimentModelLive } from "./CoinMarketCapSentimentApi.ts";

export { CoinGeckoModel } from "./CoinGeckoApi.ts";
export { FreeCryptoAPIModel } from "./FreeCryptoAPIApi.ts";
export { CoinMarketCapDexModel, CoinMarketCapDexModelLive } from "./CoinMarketCapDexApi.ts";
export { CoinMarketCapSentimentModel, CoinMarketCapSentimentModelLive } from "./CoinMarketCapSentimentApi.ts";

export const CryptoModelLive = Layer.mergeAll(
  CoinGeckoModelLive,
  FreeCryptoAPIModelLive,
  CoinMarketCapDexModelLive,
  CoinMarketCapSentimentModelLive,
);
