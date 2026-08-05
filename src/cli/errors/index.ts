import { Effect, Data } from "effect";
import { CommandResultType, type CommandState, type TerminalUserStateConfig } from "src/cli/types.ts";

export const ConfigErrorTag = "hyperterm.errors.ConfigError";
export class ConfigError extends Data.TaggedError(ConfigErrorTag) <{
  message: string
}> {}

export const HTTPErrorTag = "hyperterm.errors.HTTPError";
export class HTTPError extends Data.TaggedError(HTTPErrorTag) <{
  message: string
}> {}

export const TimeoutErrorTag = "hyperterm.errors.TimeoutError";
export class TimeoutError extends Data.TaggedError(TimeoutErrorTag) <{
  message: string
}> {}

export const UnknownErrorTag = "hyperterm.errors.UnknownError";
export class UnknownError extends Data.TaggedError(UnknownErrorTag) <{
  message: string
}> {}

export const InvalidStateErrorTag = "hyperterm.errors.InvalidStateError";
export class InvalidStateError extends Data.TaggedError(InvalidStateErrorTag) <{
  message: string
}> {}

export const LocalProcessingErrorTag = "hyperterm.errors.LocalProcessingError";
export class LocalProcessingError extends Data.TaggedError(LocalProcessingErrorTag) <{
  message: string
}> {}

export type ProgramError = HTTPError | ConfigError | TimeoutError | UnknownError |
  InvalidStateError | LocalProcessingError;

const errorResult = (
  type: typeof CommandResultType.Error | typeof CommandResultType.Timeout,
  state: TerminalUserStateConfig,
): CommandState => ({ result: { type }, state });

/**
 * Convert ProgramError types into successful CommandState values.
 * Pipe this onto an Effect<CommandState, ProgramError, R> to get
 * Effect<CommandState, never, R>.
 */
export const mapErrorsToCommandResults = (state: TerminalUserStateConfig) =>
  Effect.catchTags({
    [HTTPErrorTag]: (e: HTTPError) =>
      Effect.logDebug(`HTTPError: ${e.message}`).pipe(
        Effect.as(errorResult(CommandResultType.Error, state)),
      ),
    [TimeoutErrorTag]: (e: TimeoutError) =>
      Effect.logDebug(`TimeoutError: ${e.message}`).pipe(
        Effect.as(errorResult(CommandResultType.Timeout, state)),
      ),
    [ConfigErrorTag]: (e: ConfigError) =>
      Effect.logDebug(`ConfigError: ${e.message}`).pipe(
        Effect.as(errorResult(CommandResultType.Error, state)),
      ),
    [UnknownErrorTag]: (e: UnknownError) =>
      Effect.logDebug(`UnknownError: ${e.message}`).pipe(
        Effect.as(errorResult(CommandResultType.Error, state)),
      ),
    [InvalidStateErrorTag]: (e: InvalidStateError) =>
      Effect.logDebug(`InvalidStateError: ${e.message}`).pipe(
        Effect.as(errorResult(CommandResultType.Error, state)),
      ),
    [LocalProcessingErrorTag]: (e: LocalProcessingError) =>
      Effect.logDebug(`LocalProcessingError: ${e.message}`).pipe(
        Effect.as(errorResult(CommandResultType.Error, state)),
      ),
  });
