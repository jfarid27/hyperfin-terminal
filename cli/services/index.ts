import { Layer } from "effect";
import { ConfigServiceLive } from "./ConfigService.ts";
import { FetchServiceLive } from "./FetchService.ts";

export const ApplicationLayerLive = Layer.merge(
  ConfigServiceLive,
  FetchServiceLive,
);
