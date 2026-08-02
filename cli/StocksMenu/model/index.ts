import { Layer } from "effect";
import { MassiveModelLive } from "./massive.ts";
import { CboeModelLive } from "./cboe.ts";

export const StocksModelLive = Layer.mergeAll(
  CboeModelLive,
  MassiveModelLive,
);
