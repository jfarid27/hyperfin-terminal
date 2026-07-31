import { OptionSymbolType } from "../types.ts";
import { Effect } from "effect";
import { CboeService } from "cli/services/CboeService.ts";
import { HTTPError, LocalProcessingError } from "cli/errors/index.ts";

/**
 * Fetch options chain for a symbol from CBOE.
 */
export const fetchOptionsChainCboe = (
  symbol: OptionSymbolType,
): Effect.Effect<unknown, HTTPError | LocalProcessingError, CboeService> =>
  Effect.gen(function* () {
    const cboe = yield* CboeService;
    return yield* cboe.getOptionsChain(symbol.id);
  });
