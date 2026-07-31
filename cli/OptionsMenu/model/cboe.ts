import { OptionSymbolType } from "../types.ts";
import { Effect, Context, Layer } from "effect";
import { CboeService } from "cli/StocksMenu/services/CboeService.ts";
import { HTTPError, LocalProcessingError } from "cli/errors/index.ts";

export interface OptionsCboeModelPort {
  chain: {
    get: (symbol: OptionSymbolType) => Effect.Effect<unknown, HTTPError | LocalProcessingError>;
  };
}

export class OptionsCboeModel extends Context.Tag("hyperfin.options.OptionsCboeModel")<
  OptionsCboeModel,
  OptionsCboeModelPort
>() {}

export const OptionsCboeModelLive = Layer.effect(
  OptionsCboeModel,
  Effect.gen(function* () {
    const cboe = yield* CboeService;
    return {
      chain: {
        get: (symbol: OptionSymbolType) => cboe.getOptionsChain(symbol.id),
      },
    } satisfies OptionsCboeModelPort;
  }),
);
