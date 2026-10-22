import type { Effect } from "effect";
import {
  type CommandState,
  TerminalUserStateConfigContext,
} from "../types.ts";
import type { ProgramError } from "../errors/index.ts";
import { catchProgramError, errorHint } from "./command_errors.ts";

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
 * Recover a data-source action's `ProgramError` into a failed `CommandState`,
 * printing the reason first.
 *
 * The runner reduces any handler error to a generic "Invalid command", which is
 * actively misleading for the failures these sources actually produce: Alpaca's
 * account-level errors (403 entitlement, 400 bad symbol, 429 rate limit) and a
 * missing key pair. Surfacing the message — plus the hint that says what to do
 * about a 403 or a missing credential — tells the user what to fix instead of
 * sending them hunting through debug logs.
 */
export const catchAlpaca = <R>(
  eff: Effect.Effect<CommandState, ProgramError, R>,
  fallback: string,
): Effect.Effect<CommandState, ProgramError, R | TerminalUserStateConfigContext> =>
  catchProgramError(eff, fallback, (message) => alpacaErrorHint(message) ?? errorHint(message));
