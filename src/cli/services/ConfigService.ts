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
}> () { }

export const ConfigServiceLive = Layer.effect(ConfigService, Effect.sync(() => ({
  ENVIRONMENT: process.env.ENVIRONMENT === "development" ? EnvironmentType.Development : EnvironmentType.Production,
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY ? Option.some(process.env.COINGECKO_API_KEY) : Option.none(),
  ALPHAVANTAGE_API_KEY: process.env.ALPHAVANTAGE_API_KEY ? Option.some(process.env.ALPHAVANTAGE_API_KEY) : Option.none(),
  BLOCKCHAINCOM_API_KEY: process.env.BLOCKCHAINCOM_API_KEY ? Option.some(process.env.BLOCKCHAINCOM_API_KEY) : Option.none(),
  FREECRYPTOAPI_API_KEY: process.env.FREECRYPTOAPI_API_KEY ? Option.some(process.env.FREECRYPTOAPI_API_KEY) : Option.none(),
  FRED_API_KEY: process.env.FRED_API_KEY ? Option.some(process.env.FRED_API_KEY) : Option.none(),
  MASSIVE_API_KEY: process.env.MASSIVE_API_KEY ? Option.some(process.env.MASSIVE_API_KEY) : Option.none(),
})));
