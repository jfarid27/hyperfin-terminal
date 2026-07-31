import { Layer } from "effect";
import { OptionsModelLive } from "../model/index.ts";
import { CboeServiceLive } from "cli/StocksMenu/services/CboeService.ts";
import { ApplicationLayerLive } from "cli/services/index.ts";

const MainServices = Layer.mergeAll(
  CboeServiceLive,
  ApplicationLayerLive,
);

export const OptionsServices = Layer.provide(OptionsModelLive, MainServices);

export const OptionsServiceLive = Layer.merge(
  OptionsServices,
  ApplicationLayerLive,
);
