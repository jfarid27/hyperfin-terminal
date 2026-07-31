import { OptionSymbolType } from "../types.ts";
import { fetchOptionsChainCboe } from "./cboe.ts";

const options = {
  cboe: {
    chain: {
      get: (symbol: OptionSymbolType) => fetchOptionsChainCboe(symbol),
    },
  },
};

export default options;
