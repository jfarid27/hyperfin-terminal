import { Layer } from "effect";
import { CboeServiceLive } from "./CboeService.ts";

export const StocksModelLive = Layer.mergeAll(
  CboeServiceLive,
);
