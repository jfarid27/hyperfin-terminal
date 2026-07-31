import { Layer } from "effect";
import { GovernmentModelLive } from "../model/index.ts";
import { ApplicationLayerLive } from "cli/services/index.ts";

export const GovernmentServices = Layer.provide(GovernmentModelLive, ApplicationLayerLive);

export const GovernmentServiceLive = Layer.merge(
  GovernmentServices,
  ApplicationLayerLive,
);
