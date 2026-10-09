import chalk from "chalk";
import { Effect } from "effect";
import {
  CommandResultType,
  type CommandState,
  TerminalUserStateConfigContext,
} from "../types.ts";
import { HTTPErrorTag, type ProgramError } from "../errors/index.ts";

/**
 * Recover an Alpaca-backed action's `HTTPError` into a failed `CommandState`,
 * printing the reason first.
 *
 * The runner reduces any handler error to a generic "Invalid command", which is
 * actively misleading for Alpaca's account-level failures (403 entitlement
 * errors, 400 bad symbol, 429 rate limit). Surfacing Alpaca's own message tells
 * the user what to fix instead of sending them hunting through debug logs.
 */
export const catchAlpaca = <R>(
  eff: Effect.Effect<CommandState, ProgramError, R>,
  fallback: string,
): Effect.Effect<CommandState, ProgramError, R | TerminalUserStateConfigContext> =>
  eff.pipe(
    Effect.catchTag(HTTPErrorTag, (e: { message: string }) =>
      Effect.gen(function* () {
        const st = yield* TerminalUserStateConfigContext;
        console.log(chalk.red(fallback));
        console.log(chalk.dim(e.message));
        return { result: { type: CommandResultType.Error }, state: st } satisfies CommandState;
      }),
    ),
  );
