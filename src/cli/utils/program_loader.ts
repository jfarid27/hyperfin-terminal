import chalk from "chalk";
import { Cause, Effect } from "effect";
import {
  CommandResultType, type Menu,
  type TerminalUserStateConfig,
} from "../types.ts";
import { dispatchMenuInput, findMenuOption, usageLine } from "./menu_dispatch.ts";
import { table } from "./table.ts";

/**
 * Read one line from stdin, or null at end of input.
 *
 * A whole line, not a buffer-full: the menu loop consumes exactly one line per
 * menu level, so two commands arriving in one write (`stocks` then
 * `chart NVDA`) must not be glued together. Reading it byte by byte leaves the
 * rest of the pipe untouched for the next level, and the bytes are decoded
 * together so a multi-byte character survives the split.
 */
const readStdinLine = (): Effect.Effect<string | null> =>
  Effect.promise(async () => {
    const decoder = new TextDecoder();
    const byte = new Uint8Array(1);
    const line: number[] = [];
    while (true) {
      const n = await Deno.stdin.read(byte);
      if (n === null) {
        return line.length > 0 ? decoder.decode(new Uint8Array(line)) : null;
      }
      if (byte[0] === 0x0a) break;
      line.push(byte[0]);
    }
    if (line[line.length - 1] === 0x0d) line.pop();
    return decoder.decode(new Uint8Array(line));
  });

// ---------------------------------------------------------------------------
// Script lifecycle helpers.
//
// A script's state carries its filename for as long as the run is live, and the
// command it is currently executing. When the commands run out the filename
// stays behind with no command — that is a finished script.
// ---------------------------------------------------------------------------
export const scriptFinished = (st: TerminalUserStateConfig): boolean =>
  Boolean(st.scriptContext?.filename) && !st.scriptContext?.currentCommand;

/** Drop a finished script from the state so the next input is read normally. */
export const clearScript = (
  st: TerminalUserStateConfig,
): TerminalUserStateConfig => ({
  ...st,
  scriptContext: {},
});

// ---------------------------------------------------------------------------
// registerTerminalApplication — the recursive menu loop, now as an Effect.
//
// Returns Effect<TerminalUserStateConfig> instead of Promise<TerminalUserStateConfig>.
// Recursion is via Effect.gen + yield* (not async/await), so the entire
// call stack stays inside the Effect runtime.
//
// Passing `{ isRoot: true }` marks the outermost menu of the application. The
// flag only matters for scripts: every enclosing menu unwinds a finished
// script back up, and the root is the one that clears it and shows itself.
// ---------------------------------------------------------------------------
/**
 * Which front end owns the terminal.
 *
 * The termui shell renders menus itself and reads keys in raw mode. A nested
 * menu loop started from inside it would call `readStdinLine()`, and raw mode
 * delivers Enter as a bare `\r` with no `\n` — the read never returns and the
 * whole app wedges. The loop therefore refuses to run while the shell owns the
 * terminal, and says so instead of hanging.
 */
let interactiveOwner: "shell" | null = null;

/** Hand the terminal over to the termui shell (see `interactiveOwner`). */
export const claimInteractiveTerminal = (): void => {
  interactiveOwner = "shell";
};

export const registerTerminalApplication = (
  menu: Menu,
  options: { isRoot?: boolean } = {},
) => {
  const isRootMenu = options.isRoot === true;

  const terminalApplication = (
    st: TerminalUserStateConfig,
  ): Effect.Effect<TerminalUserStateConfig> =>
    Effect.gen(function* () {

      // --- The shell owns the terminal ------------------------------------
      // A nested menu loop reads stdin, which is raw mode while the shell is
      // up: Enter then arrives without a newline and the read never completes.
      // Report the missing link and hand the state straight back.
      if (interactiveOwner === "shell") {
        console.log(chalk.yellow(
          `${menu.name} has no submenu link — the shell cannot open it.`,
        ));
        return st;
      }

      // --- Finished scripts return to the top-level menu ------------------
      // A script's commands are exhausted once its state still carries the
      // script's filename but no command to run. The command that ran last may
      // have run inside a nested submenu (`stocks` then `chart NVDA`), and that
      // submenu is not where the user should end up, so hand the state to the
      // enclosing menu instead of showing this menu. Each enclosing menu
      // unwinds the same way; the root clears the script context and shows the
      // main menu again.
      if (scriptFinished(st)) {
        if (isRootMenu) {
          return yield* terminalApplication(clearScript(st));
        }
        return st;
      }

      const menu_options = menu.options(st);

      // Show menu only when not in script mode
      if (!st.scriptContext?.currentCommand) {
        console.log(chalk.blue(menu.name));
        const tableDescriptions = menu_options.map((option) =>
          [option.name, option.command, option.description],
        );
        table([
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
      } else {
        process.stdout.write(menu.name + " > ");
        const line = yield* readStdinLine();
        if (line === null) {
          console.log(chalk.yellow("No input on stdin — exiting."));
          process.exit(0);
          return yield* Effect.die("unreachable");
        }
        input = line.trim();
      }

      if (!input) {
        return yield* terminalApplication(st);
      }
      process.stdout.write("\n");

      // --- Build commander program --------------------------------------
      // The dispatch half of the loop lives in `dispatchMenuInput` so the
      // termui shell can run commands through the exact same pipeline
      // (commander registration, error mapping, session logging) without
      // inheriting this loop's blocking input read.
      //
      // In script mode each option's action receives the *next* line as its
      // state: `stocks` is handed a state whose currentCommand is
      // `chart NVDA`, so the child menu runs that instead of prompting.
      const [nextCommand, ...rest] = st.scriptContext?.tailCommands || [];
      const dispatchState: TerminalUserStateConfig = isScriptExecution
        ? {
          ...st,
          scriptContext: {
            ...st.scriptContext,
            currentCommand: nextCommand,
            tailCommands: rest,
          },
        }
        : st;

      const result = yield* dispatchMenuInput(menu_options, input, st, {
        stateForOption: () => dispatchState,
      }).pipe(
        // Commander's `exitOverride` turns a line it cannot parse — a missing
        // required argument, one word too many — into an error rather than an
        // exit. Report the command's usage and keep the loop alive instead of
        // letting it escape and take the process down.
        //
        // `catchAllCause`, not `catchAll`: the dispatch is forked and raced, so
        // by the time commander's error surfaces here it is a defect, not a
        // typed failure. A typed catch misses it — which is why the loop used
        // to print the generic "unhandled critical error" instead.
        Effect.catchAllCause((cause) =>
          // A command that cannot run *inside a script* aborts the script: the
          // loop's abort path reports it and unwinds to the main menu, which is
          // the contract the script tests pin. Re-raise and leave that alone.
          st.scriptContext?.currentCommand
            ? Effect.failCause(cause)
            : Effect.sync(() => {
              const option = findMenuOption(menu_options, input);
              const detail = [...Cause.failures(cause), ...Cause.defects(cause)]
                .map((reason) => reason instanceof Error ? reason.message : String(reason))
                .join("; ");
              console.log(chalk.red(option ? usageLine(option) : `unknown command: ${input}`));
              if (detail) console.log(chalk.gray(`  (${detail})`));
              return { result: { type: CommandResultType.Error }, state: st };
            })
        ),
      );

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

            // `--oet-script` is a batch run: report the failure as an exit code
            // instead of opening a menu.
            if (st.scriptContext?.exitAfterCompletion) {
              return yield* Effect.sync(() => {
                process.exit(1);
                return st;
              });
            }

            // No commands left after a failure, so treat the script as
            // finished and let the enclosing menus unwind to the top-level
            // menu rather than dropping the user into whichever submenu the
            // failing command ran in.
            const abortState: TerminalUserStateConfig = {
              ...st,
              scriptContext: {
                ...st.scriptContext,
                currentCommand: undefined,
                tailCommands: [],
              },
            };
            return yield* terminalApplication(abortState);
          }

          return yield* terminalApplication(st);
        }),
      ),
    );

  return terminalApplication;
};
