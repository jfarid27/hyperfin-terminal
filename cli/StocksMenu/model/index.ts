import { Layer } from "effect";
import { AlphaVantageModelLive } from "./alphavantage.ts";
import { MassiveModelLive } from "./massive.ts";
import { CboeModelLive } from "./cboe.ts";

export const StocksModelLive = Layer.mergeAll(
  CboeModelLive,
  MassiveModelLive,
  AlphaVantageModelLive
);
