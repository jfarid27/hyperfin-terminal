import { Layer } from "effect";
import { KalshiModelLive } from "../model/Kalshi.ts";
import { ApplicationLayerLive } from "cli/services/index.ts";

export const KalshiServices = Layer.provide(KalshiModelLive, ApplicationLayerLive);

export const KalshiServiceLive = Layer.merge(
  KalshiServices,
  ApplicationLayerLive,
);
