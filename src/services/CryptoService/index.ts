import { Layer } from "effect";
import { CryptoModelLive } from "../../cli/CryptoMenu/model/index.ts";
import { ApplicationLayerLive } from "src/cli/services/index.ts";

export const CryptoServices = Layer.provide(CryptoModelLive, ApplicationLayerLive);

export const CryptoServiceLive = Layer.merge(
  CryptoServices,
  ApplicationLayerLive,
);
