import { Effect, Data } from "effect";
import { CommandResultType } from "cli/types.ts";

export const ConfigErrorTag = "hyperterm.errors.ConfigError";
// Represents a configuration error.
export class ConfigError extends Data.TaggedError(ConfigErrorTag) <{
  message: string
}> {}

export const HTTPErrorTag = "hyperterm.errors.HTTPError";
// Represents an HTTP call failure.
export class HTTPError extends Data.TaggedError(HTTPErrorTag) <{
  message: string
}> {}

export const TimeoutErrorTag = "hyperterm.errors.TimeoutError";
// Represents a timeout error.
export class TimeoutError extends Data.TaggedError(TimeoutErrorTag) <{
  message: string
}> {}

export const UnknownErrorTag = "hyperterm.errors.UnknownError";
// Represents an unknown error that caused by an unchecked failure.
export class UnknownError extends Data.TaggedError(UnknownErrorTag) <{
  message: string
}> {}

export const InvalidStateErrorTag = "hyperterm.errors.InvalidStateError";
// Represents a failure when an expected state or constraint has been violated.
export class InvalidStateError extends Data.TaggedError(InvalidStateErrorTag) <{
  message: string
}> {}

export const LocalProcessingErrorTag = "hyperterm.errors.LocalProcessingError";
// Represents a failure during local processing.
export class LocalProcessingError extends Data.TaggedError(LocalProcessingErrorTag) <{
  message: string
}> {}

export type ProgramError = HTTPError | ConfigError | TimeoutError | UnknownError |
  InvalidStateError | LocalProcessingError;

  /**
   * Convert errors to appropriate command results.
   */
export const mapErrorsToCommandResults = (resolve: any, state: any) => Effect.catchTags({
    [HTTPErrorTag]: (_error) => Effect.sync(() => {
      resolve({
          result: { type: CommandResultType.Error },
          state: state,
      });
    }),
    [TimeoutErrorTag]: (_error) => Effect.sync(() => {
      resolve({
          result: { type: CommandResultType.Timeout },
          state: state,
      });
    }),
    [ConfigErrorTag]: (_error) => Effect.sync(() => {
      resolve({
          result: { type: CommandResultType.Timeout },
          state: state,
      });
    }),
    [UnknownErrorTag]: (_error) => Effect.sync(() => {
      resolve({
          result: { type: CommandResultType.Error },
          state: state,
      });
    }),
    [InvalidStateErrorTag]: (_error) => Effect.sync(() => {
      resolve({
          result: { type: CommandResultType.Error },
          state: state,
      });
    }),
    [LocalProcessingErrorTag]: (_error) => Effect.sync(() => {
      resolve({
          result: { type: CommandResultType.Error },
          state: state,
      });
    }),
  });
