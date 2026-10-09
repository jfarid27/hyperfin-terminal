import { Effect, Layer, Context, Option } from "effect";
import { EnvironmentType } from "src/cli/types.ts";
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
