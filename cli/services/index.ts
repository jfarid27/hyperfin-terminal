import { Layer } from "effect";
import { ConfigServiceLive } from "./ConfigService.ts";
import { FetchServiceLive } from "./FetchService.ts";
import { CboeServiceLive } from "./CboeService.ts";
import { StocksModelLive } from "cli/StocksMenu/model/index.ts";

export const ApplicationLayerLive = Layer.mergeAll(
  ConfigServiceLive,
  FetchServiceLive,
  CboeServiceLive,
  StocksModelLive,
);
