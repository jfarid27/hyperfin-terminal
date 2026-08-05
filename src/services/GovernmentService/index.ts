import { Layer } from "effect";
import { GovernmentModelLive } from "../../cli/GovernmentMenu/model/index.ts";
import { ApplicationLayerLive } from "src/cli/services/index.ts";

export const GovernmentServices = Layer.provide(GovernmentModelLive, ApplicationLayerLive);

export const GovernmentServiceLive = Layer.merge(
  GovernmentServices,
  ApplicationLayerLive,
);
