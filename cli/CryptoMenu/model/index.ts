import { Layer } from "effect";
import { CoinGeckoModelLive } from "./CoinGeckoApi.ts";
import { FreeCryptoAPIModelLive } from "./FreeCryptoAPIApi.ts";

export { CoinGeckoModel } from "./CoinGeckoApi.ts";
export { FreeCryptoAPIModel } from "./FreeCryptoAPIApi.ts";

export const CryptoModelLive = Layer.mergeAll(
  CoinGeckoModelLive,
  FreeCryptoAPIModelLive,
);
