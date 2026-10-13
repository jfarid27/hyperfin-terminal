import chalk from "chalk";
import { Effect } from "effect";
import {
  CommandResultType,
  type CommandState,
  TerminalUserStateConfigContext,
} from "../types.ts";
import { HTTPErrorTag, type ProgramError } from "../errors/index.ts";

/**
 * What an Alpaca entitlement failure means, and what to do about it.
 *
 * Alpaca answers `403 forbidden: insufficient grants` when the account's data
 * plan does not cover the feed being asked for — the whole `/v1beta1/forex/*`
 * family on a plan without FX market data, for instance. It is an account
 * setting rather than a bad symbol or a bad pair: every pair fails identically,
 * and equity feeds on the same key keep working.
 */
export const ENTITLEMENT_HINT =
  "This feed is not in your Alpaca data plan — every pair fails the same way. " +
  "Switch this menu with `source alphavantage`, or add the feed to your Alpaca subscription.";

/**
 * The extra explanation an Alpaca error earns, or undefined for the ones that
 * speak for themselves (a bad symbol, a rate limit, a network failure).
 */
export const alpacaErrorHint = (message: string): string | undefined =>
  /insufficient grants|forbidden/i.test(message) ? ENTITLEMENT_HINT : undefined;

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
        const hint = alpacaErrorHint(e.message);
        if (hint) console.log(chalk.yellow(hint));
        return { result: { type: CommandResultType.Error }, state: st } satisfies CommandState;
      }),
    ),
  );
