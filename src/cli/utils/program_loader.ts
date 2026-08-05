import chalk from "chalk";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import { Command } from "commander";
import {
  type CommandState, CommandResultType, type Menu, type MenuOption,
  type TerminalUserStateConfig,
  TerminalUserStateConfigContext
} from "../types.ts";
import { Effect, Fiber, Logger } from "effect";
import { mapErrorsToCommandResults } from "src/cli/errors/index.ts";
import { installGlobalHandlers } from "./global_handlers.ts";
import { logSessionArgs } from "./session_logging.ts";

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

// ---------------------------------------------------------------------------
// registerTerminalApplication — the recursive menu loop, now as an Effect.
//
// Returns Effect<TerminalUserStateConfig> instead of Promise<TerminalUserStateConfig>.
// Recursion is via Effect.gen + yield* (not async/await), so the entire
// call stack stays inside the Effect runtime.
// ---------------------------------------------------------------------------
export const registerTerminalApplication = (menu: Menu) => {

  const terminalApplication = (
    st: TerminalUserStateConfig,
  ): Effect.Effect<TerminalUserStateConfig> =>
    Effect.gen(function* () {

      installGlobalHandlers();

      const menu_options = menu.options(st);

      // Show menu only when not in script mode
      if (!st.scriptContext?.currentCommand) {
        console.log(chalk.blue(menu.name));
        const tableDescriptions = menu_options.map((option) =>
          [option.name, option.command, option.description],
        );
        terminal.table([
          ["Name", "Command", "Description"],
          ...tableDescriptions,
        ], {
          hasBorder: true,
          contentHasMarkup: true,
          borderChars: "lightRounded",
          borderAttr: { color: "cyan" },
          textAttr: { bgColor: "default" },
          firstRowTextAttr: { bgColor: "cyan" },
          width: 120,
          fit: true,
        });
      }

      // --- Read input ---------------------------------------------------
      let input = "";
      let isScriptExecution = false;

      if (st.scriptContext?.currentCommand) {
        input = st.scriptContext.currentCommand;
        console.log(chalk.yellow(`Executing script command: ${input}`));
        isScriptExecution = true;
      } else if (!Deno.stdin.isTerminal()) {
        const decoder = new TextDecoder();
        const buf = new Uint8Array(4096);
        const n = yield* Effect.promise(() => Deno.stdin.read(buf));
        if (n === null) {
          console.log(chalk.yellow("No input on stdin — exiting."));
          process.exit(0);
          return yield* Effect.die("unreachable");
        }
        input = decoder.decode(buf.subarray(0, n)).trim();
        input = input.split("\n")[0].trim();
      } else {
        terminal(menu.name + " > ");
        const answer = yield* Effect.promise<string>(() =>
          new Promise((resolve) => {
            terminal.inputField((_error, inp) => resolve(inp || ""));
          }),
        );
        input = answer?.trim();
      }

      if (!input) {
        if (!Deno.stdin.isTerminal()) {
          return yield* Effect.die("no stdin input");
        }
        return yield* terminalApplication(st);
      }
      terminal("\n");

      // --- Build commander program --------------------------------------
      const program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: (str) => process.stdout.write(chalk.red(str)),
      });

      // Create lazy effects for every menu option
      const effects: Effect.Effect<CommandState>[] = menu_options.map((option) => {
        if (isScriptExecution) {
          const [nextCommand, ...rest] = st.scriptContext.tailCommands || [];
          const nextScriptState: TerminalUserStateConfig = {
            ...st,
            scriptContext: {
              ...st.scriptContext,
              currentCommand: nextCommand,
              tailCommands: rest,
            },
          };
          return loadProgram(program, option, nextScriptState);
        }
        return loadProgram(program, option, st);
      });

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

      // Log the input immediately
      yield* logSessionArgs(args, st);

      // Dispatch to commander — this triggers the matching action
      yield* Effect.promise(() => program.parseAsync(args, { from: "user" }));

      // Race all fibers — the first one to resolve wins.
      // Non-matching fibers are daemons and will be cleaned up when
      // this gen block's scope exits.
      const result = yield* Effect.raceAll(fibers.map((f) => Fiber.join(f)));

      // --- Handle result ------------------------------------------------
      if (result.result.type === CommandResultType.Back) {
        return result.state;
      }

      if (result.result.type === CommandResultType.Exit) {
        return yield* Effect.sync(() => {
          process.exit(0);
          // unreachable, but satisfies the type
          return st;
        });
      }

      if (result.result.type === CommandResultType.Timeout) {
        console.log(chalk.red("Command timed out"));
      }

      if (result.result.type === CommandResultType.Error) {
        console.log(chalk.red("Invalid command"));
      }

      const nextState = result.state;

      if (
        isScriptExecution &&
        nextState.scriptContext?.exitAfterCompletion &&
        !nextState.scriptContext?.currentCommand
      ) {
        console.log(chalk.green("Script execution completed successfully"));
        return yield* Effect.sync(() => {
          process.exit(0);
          return st;
        });
      }

      return yield* terminalApplication(nextState);
    }).pipe(
      Effect.catchAllDefect((defect) =>
        Effect.gen(function* () {
          console.log(chalk.red("An unhandled critical error occurred during running."));
          console.log(chalk.red(defect));

          if (st.scriptContext?.currentCommand) {
            console.log(chalk.red("Script execution aborted due to error."));

            if (st.scriptContext?.exitAfterCompletion) {
              return yield* Effect.sync(() => {
                process.exit(1);
                return st;
              });
            }

            const abortState = {
              ...st,
              scriptContext: {} as typeof st.scriptContext,
            };
            return yield* terminalApplication(abortState);
          }

          return yield* terminalApplication(st);
        }),
      ),
    );

  return terminalApplication;
};
