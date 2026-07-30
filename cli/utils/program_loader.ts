import chalk from "chalk";
import terminalKit from "terminal-kit";
const { terminal } = terminalKit;
import { Command } from "commander";
import {
  CommandState, CommandResultType, Menu, MenuOption,
  TerminalUserStateConfig,
  TerminalUserStateConfigContext, LogLevel
} from "../types.ts";
import { inspectLogger } from './logging.ts';
import { Effect } from "effect";

/**
 * Wrap a commander program into a resolvable promise from a menu option.
 *
 * The reason this exists is because commander actions return promises of void,
 * but we need to resolve the command state of a completed action and pass it to
 * the next call.
 *
 * @param program The commander program to wrap.
 * @param menuOption The menu option to wrap.
 * @param state The terminal user state config.
 * @param ops The options for the program.
 * @returns A promise that resolves to the command state.
 */
export function loadProgram(program: Command, menuOption: MenuOption, state: TerminalUserStateConfig, ...ops: any) {
    return new Promise<CommandState>((resolve, reject) => {
        program
            .command(menuOption.command)
            .description(menuOption.description)
            .action(async (...args: any[]) => {

              const tusccService = Effect.provideService(
                TerminalUserStateConfigContext, state
              );

              // Compose the action effect with the deferred effect.
              const actionEffect = Effect.gen(function* () {
                const res = yield* menuOption.action(...args);
                resolve(res);
              }).pipe(
                Effect.catchAll((_error) => Effect.gen(function*() {
                  console.log(chalk.red("An error occurred during fetching."))
                  yield* Effect.logError(_error);
                  reject({
                      result: { type: CommandResultType.Error },
                      state: state,
                  });
                })),
                tusccService,
              );

              try {
                await Effect.runPromise(actionEffect);
              } catch (error) {
                console.log("A critical error has occurred when running the action.");
                console.error("Error:");
                console.error(error)
              }

              // Set the timeout only if the action callback is set
              if (ops?.timeout || state?.actionTimeout) {
                  setTimeout(() => {
                      console.log(chalk.red("Command timed out"));
                      reject({
                          result: { type: CommandResultType.Timeout },
                          state: state,
                      });
                  }, ops?.timeout || state?.actionTimeout);
              }
            });

    });
}

/*
 * Register a terminal application from a menu. Note the function is curried to allow
 * the terminal application runner to pass the menu registry and user state in separate calls.
 *
 * @param menu The menu to register.
 * @returns A function that takes a terminal user state config and returns a promise that resolves to the terminal user state config.
 */
export const registerTerminalApplication = (menu: Menu) => {

    async function terminalApplication(st: TerminalUserStateConfig): Promise<TerminalUserStateConfig> {

        const applicationLogging = inspectLogger(st);
        const menu_options = menu.options(st);
        // Only show menu if not in script mode
        if (!st.scriptContext?.currentCommand) {
            console.log(chalk.blue(menu.name));
            const tableDescriptions = menu_options.map((option) => [option.name, option.command, option.description]);

            terminal.table([
                ['Name', 'Command', 'Description'],
                ...tableDescriptions,
            ], {
                hasBorder: true,
                contentHasMarkup: true,
                borderChars: 'lightRounded',
                borderAttr: { color: 'cyan' },
                textAttr: { bgColor: 'default' },
                firstRowTextAttr: { bgColor: 'cyan' },
                width: 120,
                fit: true
            });
        }

        try {
            let input = "";
            let isScriptExecution = false;

            if (st.scriptContext?.currentCommand) {
                input = st.scriptContext.currentCommand;
                console.log(chalk.yellow(`Executing script command: ${input}`));
                isScriptExecution = true;
            } else {
                terminal(menu.name + " > ");
                const answer = await new Promise<string>((resolve) => {
                    terminal.inputField((_error, input) => {
                        resolve(input || '');
                    });
                });
                input = answer?.trim();
            }

            if (!input) return terminalApplication(st);
            terminal('\n');

            const program = new Command();
            program.exitOverride();
            program.configureOutput({
              writeErr: (str) => process.stdout.write(chalk.red(str)),
            });

            const resultPs: Promise<CommandState>[] = menu_options.map((option) => {
                if (isScriptExecution) {
                    const [nextCommand, ...rest] = st.scriptContext.tailCommands || [];

                    const nextScriptState: TerminalUserStateConfig = {
                        ...st,
                        scriptContext: {
                            ...st.scriptContext,
                            currentCommand: nextCommand,
                            tailCommands: rest
                        }
                    };
                    return loadProgram(program, option, nextScriptState)
                }
                return loadProgram(program, option, st)
            });

            const args = input.split(/\s+/);
            await program.parseAsync(args, { from: "user" });
            const result = await Promise.race(resultPs);

            if (result && result.result.type === CommandResultType.Back) {
                return result.state;
            }

            if (result && result.result.type === CommandResultType.Exit) {
                process.exit(0);
            }

            let nextState = result.state;

            // Check if script has completed and should exit
            if (isScriptExecution &&
                nextState.scriptContext?.exitAfterCompletion &&
                !nextState.scriptContext?.currentCommand) {
                console.log(chalk.green("Script execution completed successfully"));
                process.exit(0);
            }

            return terminalApplication(nextState);

        } catch (err: any) {
            if (err.result?.type === CommandResultType.Timeout) {
                console.log(chalk.red("Command timed out"));
            }

            if (err.result?.type === CommandResultType.Error) {
                console.log(chalk.red("Command failed"));
            }

            applicationLogging(LogLevel.Error)(err);
            console.log(chalk.red("Not a valid command"));

            // Fix for script loop on error:
            // If error occurred during script execution, abort.
            if (st.scriptContext?.currentCommand) {
                console.log(chalk.red("Script execution aborted due to error."));

                // If running from command line with --oet-script, exit with error code
                if (st.scriptContext?.exitAfterCompletion) {
                    process.exit(1);
                }

                const abortState = {
                    ...st,
                    scriptContext: {} // Clear script context
                };
                return terminalApplication(abortState);
            }

            return terminalApplication(st);
        }

    }

    return terminalApplication;
}
