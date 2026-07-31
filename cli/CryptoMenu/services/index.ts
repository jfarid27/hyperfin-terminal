import { Layer } from "effect";
import { CryptoModelLive } from "../model/index.ts";
import { ApplicationLayerLive } from "cli/services/index.ts";

export const CryptoServices = Layer.provide(CryptoModelLive, ApplicationLayerLive);

export const CryptoServiceLive = Layer.merge(
  CryptoServices,
  ApplicationLayerLive,
);
