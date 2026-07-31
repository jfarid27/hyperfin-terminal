import { Layer } from "effect";
import { FredModelLive } from "./fred.ts";

export { FredModel } from "./fred.ts";

export const GovernmentModelLive = Layer.mergeAll(
  FredModelLive,
);
