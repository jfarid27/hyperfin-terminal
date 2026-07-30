import { Data } from "effect";

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

export type ProgramError = HTTPError | ConfigError | TimeoutError | UnknownError;
