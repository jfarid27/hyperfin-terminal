import { Effect, Layer, Context, Option } from "effect";
import { APIKeyType, EnvironmentType } from "src/cli/types.ts";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

export class ConfigService extends Context.Tag("hyperfin.service.ConfigService")<ConfigService, {
  ENVIRONMENT: EnvironmentType,
  COINGECKO_API_KEY: Option.Option<string>,
  ALPHAVANTAGE_API_KEY: Option.Option<string>,
  BLOCKCHAINCOM_API_KEY: Option.Option<string>,
  FREECRYPTOAPI_API_KEY: Option.Option<string>,
  FRED_API_KEY: Option.Option<string>,
  MASSIVE_API_KEY: Option.Option<string>,
  ALPACA_API_KEY: Option.Option<string>,
  ALPACA_API_SECRET: Option.Option<string>
}> () { }

const liftNullish = (y:unknown) => y ? Option.some(String(y)) : Option.none();

/**
 * The environment variable(s) backing each API key type.
 *
 * Data services resolve credentials through `ConfigService`, which reads
 * `process.env`, while the in-app `keys` command only wrote `st.apiKeys` — state
 * no .env-backed service reads. The command mirrors its value into these names
 * so `keys alphavantage <key>` actually configures the running process.
 *
 * Alpaca is keyed by a pair of variables; `keys alpaca` can only supply the key
 * id, so the secret still has to come from `.env`.
 */
export const API_KEY_ENV_VAR: Record<APIKeyType, readonly string[]> = {
  [APIKeyType.CoinGecko]: ["COINGECKO_API_KEY"],
  [APIKeyType.Alphavantage]: ["ALPHAVANTAGE_API_KEY"],
  [APIKeyType.BlockchainCom]: ["BLOCKCHAINCOM_API_KEY"],
  [APIKeyType.FreeCryptoAPI]: ["FREECRYPTOAPI_API_KEY"],
  [APIKeyType.Fred]: ["FRED_API_KEY"],
  [APIKeyType.Massive]: ["MASSIVE_API_KEY"],
  [APIKeyType.YahooFinance]: [],
  [APIKeyType.Alpaca]: ["ALPACA_API_KEY"],
  [APIKeyType.CoinMarketCap]: ["CMC_API_KEY"],
};

const makeConfig = () => Effect.sync(() => ({
  ENVIRONMENT: process.env.ENVIRONMENT === "development" ? EnvironmentType.Development : EnvironmentType.Production,
  COINGECKO_API_KEY: liftNullish(process.env.COINGECKO_API_KEY),
  ALPHAVANTAGE_API_KEY: liftNullish(process.env.ALPHAVANTAGE_API_KEY),
  BLOCKCHAINCOM_API_KEY: liftNullish(process.env.BLOCKCHAINCOM_API_KEY),
  FREECRYPTOAPI_API_KEY: liftNullish(process.env.FREECRYPTOAPI_API_KEY),
  FRED_API_KEY: liftNullish(process.env.FRED_API_KEY),
  MASSIVE_API_KEY: liftNullish(process.env.MASSIVE_API_KEY),
  ALPACA_API_KEY: liftNullish(process.env.ALPACA_API_KEY),
  ALPACA_API_SECRET: liftNullish(process.env.ALPACA_API_SECRET),
}));

export const ConfigServiceLive = Layer.effect(ConfigService, makeConfig());
