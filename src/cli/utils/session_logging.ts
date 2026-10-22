import { Effect } from 'effect';
import {
  TerminalUserStateConfig,
} from "../types.ts";

/** Commands whose later arguments carry a secret (the `keys` value slot). */
const SECRET_COMMANDS = new Set(["keys"]);

/**
 * Mask the value argument of a secret-carrying command before it is logged.
 *
 * Session files are plain text on disk, so `keys alphavantage <KEY>` must not be
 * written verbatim — the log is a record of inputs, not a key store.
 */
export const redactSessionArgs = (args: string[]): string[] => {
  const [command, ...rest] = args;
  if (!command || !SECRET_COMMANDS.has(command)) return args;
  if (rest.length < 2) return args;
  return [command, rest[0], "***", ...rest.slice(2)];
};

/**
 * Append command argument strings to the session log file.
 */
export const logSessionArgs = (
  args: string[],
  state: TerminalUserStateConfig,
): Effect.Effect<void> => {
  if (!state.sessionPath) return Effect.void;
  return Effect.tryPromise(() =>
      Deno.writeTextFile(state.sessionPath, `${redactSessionArgs(args).join(" ")}\n`, { append: true })
  ).pipe(
    Effect.catchAll(() => Effect.void),
  );
}
