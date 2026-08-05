import { Layer } from "effect";
import { KalshiModelLive } from "./types.ts";
import { ApplicationLayerLive } from "src/cli/services/index.ts";

export const KalshiServices = Layer.provide(KalshiModelLive, ApplicationLayerLive);

export const KalshiServiceLive = Layer.merge(
  KalshiServices,
  ApplicationLayerLive,
);
