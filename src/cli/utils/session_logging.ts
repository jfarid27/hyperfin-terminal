import { Effect } from 'effect';
import {
  TerminalUserStateConfig,
} from "../types.ts";
/**
 * Append command argument strings to the session log file.
 */
export const logSessionArgs = (
  args: string[],
  state: TerminalUserStateConfig,
): Effect.Effect<void> => {
  if (!state.sessionPath) return Effect.void;
  return Effect.tryPromise(() =>
      Deno.writeTextFile(state.sessionPath, `${args.join(" ")}\n`, { append: true })
  ).pipe(
    Effect.catchAll(() => Effect.void),
  );
}
