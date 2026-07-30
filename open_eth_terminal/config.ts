import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { EnvironmentType } from "./types.ts";

export const ENVIRONMENT = process.env.ENVIRONMENT === "development" ? EnvironmentType.Development : EnvironmentType.Production;
export const LOG_LEVEL: string | undefined = process.env.LOG_LEVEL || undefined;
export const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
export const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY;
export const BLOCKCHAINCOM_API_KEY = process.env.BLOCKCHAINCOM_API_KEY;
export const FREECRYPTOAPI_API_KEY = process.env.FREECRYPTOAPI_API_KEY;
export const FRED_API_KEY = process.env.FRED_API_KEY;
export const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;