import chalk from "chalk";
import { Effect } from "effect";
import {
  type CommandState,
  CommandResultType,
  TerminalUserStateConfigContext,
  type TerminalUserStateConfig,
} from "../types.ts";
import {
  ConfigErrorTag,
  HTTPErrorTag,
  InvalidStateErrorTag,
  LocalProcessingErrorTag,
  TimeoutErrorTag,
  UnknownErrorTag,
  type ProgramError,
} from "../errors/index.ts";

/**
 * The guidance a failure earns when the user can do something about it.
 *
 * A data source with no credentials reports a `ConfigError` whose message names
 * the variable; without the hint the user is left guessing where it belongs.
 */
export const errorHint = (message: string): string | undefined => {
  if (/Missing Alphavantage API Key/i.test(message)) {
    return "Set ALPHAVANTAGE_API_KEY in .env (or run `keys alphavantage <key>`), then rerun the command.";
  }
  if (/Missing Alpaca credentials/i.test(message)) {
    return "Set ALPACA_API_KEY and ALPACA_API_SECRET in .env. Alpaca forex data also needs a plan with FX market data.";
  }
  return undefined;
};

/** Print the reason a command failed, plus any hint that applies. */
export const reportError = (
  st: TerminalUserStateConfig,
  fallback: string,
  message: string,
  hint?: string,
): CommandState => {
  console.log(chalk.red(fallback));
  console.log(chalk.dim(message));
  if (hint) console.log(chalk.yellow(hint));
  return { result: { type: CommandResultType.Error }, state: st };
};

/**
 * Recover an action's `ProgramError` into a failed `CommandState`, printing the
 * reason first.
 *
 * `mapErrorsToCommandResults` reduces every handler error to a bare
 * `CommandResultType.Error`, which both front ends show as "Invalid command" —
 * so a missing API key, a 403 entitlement failure and a rate limit all look like
 * a typo. Every data-source branch that can fail for an environmental reason
 * (credentials, subscription, throttling) should funnel through this instead.
 */
export const catchProgramError = <R>(
  eff: Effect.Effect<CommandState, ProgramError, R>,
  fallback: string,
  hint: (message: string) => string | undefined = errorHint,
): Effect.Effect<CommandState, ProgramError, R | TerminalUserStateConfigContext> => {
  const handle = (e: { message: string }) =>
    Effect.gen(function* () {
      const st = yield* TerminalUserStateConfigContext;
      return reportError(st, fallback, e.message, hint(e.message));
    });

  return eff.pipe(
    Effect.catchTags({
      [ConfigErrorTag]: handle,
      [HTTPErrorTag]: handle,
      [TimeoutErrorTag]: handle,
      [UnknownErrorTag]: handle,
      [InvalidStateErrorTag]: handle,
      [LocalProcessingErrorTag]: handle,
    }),
  );
};
