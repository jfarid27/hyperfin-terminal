import { Layer } from "effect";
import { PolymarketModelLive } from "../model/Polymarket.ts";
import { ApplicationLayerLive } from "src/cli/services/index.ts";

export const PolymarketServices = Layer.provide(PolymarketModelLive, ApplicationLayerLive);

export const PolymarketServiceLive = Layer.merge(
  PolymarketServices,
  ApplicationLayerLive,
);
