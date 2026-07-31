import { Layer } from "effect";
import { RedditModelLive } from "./reddit.ts";

export { RedditModel } from "./reddit.ts";

export const NewsModelLive = Layer.mergeAll(
  RedditModelLive,
);
