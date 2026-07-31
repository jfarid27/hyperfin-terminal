import { Layer, Effect } from "effect";
import { CboeServiceLive } from "./CboeService.ts";
import { StocksModelLive } from "../model/index.ts";
import { ApplicationLayerLive } from "cli/services/index.ts";

const MainServices = Layer.mergeAll(
  CboeServiceLive,
  ApplicationLayerLive
)

export const StocksServices = Layer.provide(StocksModelLive, MainServices)

export const StocksServiceLive = Layer.merge(
  StocksServices,
  ApplicationLayerLive
)
