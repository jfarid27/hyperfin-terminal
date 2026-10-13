import chalk from "chalk";
import { Command } from "commander";
import { Effect, Fiber, Logger } from "effect";
import { mapErrorsToCommandResults } from "../errors/index.ts";
import { logSessionArgs } from "./session_logging.ts";
import {
  type CommandState,
  type MenuOption,
  type TerminalUserStateConfig,
  TerminalUserStateConfigContext,
} from "../types.ts";

// ---------------------------------------------------------------------------
// loadProgram — wraps a commander action into an Effect<CommandState>.
// The Effect is lazy: it only runs when forked/executed, which happens
// after commander's parseAsync dispatches the matching command.
// ---------------------------------------------------------------------------
export function loadProgram(
  program: Command,
  menuOption: MenuOption,
  state: TerminalUserStateConfig,
): Effect.Effect<CommandState> {
  return Effect.promise<CommandState>(() =>
    new Promise<CommandState>((resolve) => {
      program
        .command(menuOption.command)
        .description(menuOption.description)
        .action(async (...args: any[]) => {
          const tusccService = Effect.provideService(
            TerminalUserStateConfigContext, state,
          );

          // Run the action, catch errors into CommandState, then resolve
          // the outer Promise. Effect.tap ensures resolve is called
          // regardless of whether the action succeeded or was caught by
          // mapErrorsToCommandResults.
          const actionEffect = menuOption.action(...args).pipe(
            mapErrorsToCommandResults(state),
            tusccService,
            Logger.withMinimumLogLevel(state.logLevel),
            Effect.tap((res) => Effect.sync(() => resolve(res))),
          );

          await Effect.runPromise(actionEffect);
        });
    }),
  );
}

export interface MenuDispatchOptions {
  /**
   * State handed to every option's action instead of `st`.
   *
   * Script runs use this to pre-consume the line the option's *own* menu will
   * read: the loop hands `stocks` an option whose state already carries
   * `chart NVDA`, so the child menu picks it up instead of prompting.
   */
  stateForOption?: () => TerminalUserStateConfig;
}

/**
 * Run one input line against a menu's options and return the command result.
 *
 * This is the dispatch half of the menu loop: register every option with
 * commander, fork their (lazy) effects, log the input, parse the line, then
 * race the fibers so the matched option's result wins.
 *
 * It does not read input and does not recurse — which is exactly what lets the
 * same machinery back both the line-based loop and the termui shell.
 */
export const dispatchMenuInput = (
  menuOptions: MenuOption[],
  input: string,
  st: TerminalUserStateConfig,
  options: MenuDispatchOptions = {},
): Effect.Effect<CommandState> =>
  Effect.gen(function* () {
    const program = new Command();
    program.exitOverride();
    program.configureOutput({
      writeErr: (str) => console.error(chalk.red(str)),
    });

    // Create lazy effects for every menu option
    const effects = menuOptions.map((option) =>
      loadProgram(program, option, options.stateForOption?.() ?? st)
    );

    // Fork all effects BEFORE parseAsync — they're lazy, so nothing
    // runs yet. parseAsync triggers commander, which calls the matching
    // action, which resolves the corresponding effect.
    // Use forkDaemon so non-matching fibers are auto-interrupted when
    // the parent scope exits — no need for explicit Fiber.interrupt
    // (which would deadlock on uninterruptible Effect.promise regions).
    const fibers = yield* Effect.all(
      effects.map((e) => Effect.forkDaemon(e)),
    );

    const args = input.split(/\s+/);

    // Log the input immediately — before dispatch. Navigation commands block
    // until their submenu returns, so logging afterwards defers the write
    // indefinitely (and loses the input entirely if the app is killed).
    yield* logSessionArgs(args, st);

    // Dispatch to commander — this triggers the matching action
    yield* Effect.promise(() => program.parseAsync(args, { from: "user" }));

    // Race all fibers — the first one to resolve wins.
    // Non-matching fibers are daemons and will be cleaned up when
    // this gen block's scope exits.
    return yield* Effect.raceAll(fibers.map((f) => Fiber.join(f)));
  });

/**
 * The usage line for a menu option: its command shape, plus the first line of
 * its description.
 *
 * Commander runs with `exitOverride`, so a line it cannot parse (a missing
 * required argument, a word too many) fails the dispatch. Both front ends turn
 * that failure into this line rather than a raw commander message.
 */
export const usageLine = (option: MenuOption): string => {
  const [summary] = option.description.split("\n");
  const trimmed = summary.trim();
  return `usage: ${option.command}${trimmed ? `\n  ${trimmed}` : ""}`;
};

/**
 * The option an input line would dispatch to, matched on its command token.
 *
 * Only the first token is matched: `chart NVDA` resolves the `chart [symbol]`
 * option, and a bare `stocks` resolves the `stocks` option. Returns undefined
 * for input that matches nothing, which the caller reports as an invalid
 * command.
 */
export const findMenuOption = (
  menuOptions: MenuOption[],
  input: string,
): MenuOption | undefined => {
  const [token] = input.trim().split(/\s+/);
  if (!token) return undefined;
  return menuOptions.find(
    (option) => option.command.split(/\s+/)[0] === token,
  );
};
