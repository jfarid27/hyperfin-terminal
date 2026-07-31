import { Layer } from "effect";
import { ConfigServiceLive } from "./ConfigService.ts";
import { FetchServiceLive } from "./FetchService.ts";
import { CboeServiceLive } from "./CboeService.ts";

export const ApplicationLayerLive = Layer.mergeAll(
  ConfigServiceLive,
  FetchServiceLive,
  CboeServiceLive,
);
