import { Layer } from "effect";
import { NewsModelLive } from "../model/index.ts";
import { ApplicationLayerLive } from "src/cli/services/index.ts";

export const NewsServices = Layer.provide(NewsModelLive, ApplicationLayerLive);

export const NewsServiceLive = Layer.merge(
  NewsServices,
  ApplicationLayerLive,
);
