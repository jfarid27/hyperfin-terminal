import {
  LocalProcessingError, HTTPError
} from "cli/errors/index.ts";
import { Effect, Layer, Context } from "effect";

export interface FetchServicePort {
  fetch: (url: string, params?: URLSearchParams, init?: RequestInit) => Effect.Effect<Response, HTTPError>,
  // deno-lint-ignore no-explicit-any
  fetchJson: (url: string, params?: URLSearchParams, init?: RequestInit) => Effect.Effect<any, HTTPError | LocalProcessingError>
}

export class FetchService extends Context.Tag("hyperfin.services.FetchService")<
  FetchService,
  FetchServicePort
>() { }

export const FetchServiceLive = Layer.succeed(FetchService, {
  fetch: (url, params, init) => {
    const fullUrl = params ? `${url}?${params}` : url;
    return Effect.tryPromise({
      try: () => fetch(fullUrl, init),
      catch: (_err) => new HTTPError({message: `Failed to fetch: ${url}`})
    });
  },
  fetchJson: (url, params, init) => {
    const fullUrl = params ? `${url}?${params}` : url;
    return Effect.tryPromise({
        try: () => fetch(fullUrl, init),
        catch: (_err) => new HTTPError({message: `Failed to fetch: ${url}`})
      }).pipe(
        Effect.flatMap((response) =>
        Effect.tryPromise({
          try: () => response.json(),
          catch: () => new LocalProcessingError({ message: "Failed to parse API response."})
        }))
    );
  },
});
