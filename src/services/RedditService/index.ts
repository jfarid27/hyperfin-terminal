import { Layer } from "effect";
import { RedditLayer } from "./types.ts";
import { ApplicationLayerLive } from "src/cli/services/index.ts";

export const RedditService = Layer.provide(RedditLayer, ApplicationLayerLive);

export const RedditServiceLive = Layer.merge(
  RedditService,
  ApplicationLayerLive,
);
