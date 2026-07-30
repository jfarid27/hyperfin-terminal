/**
 * @file HyperFinTerminal — Bloomberg-style TUI that reuses existing menu infrastructure.
 *
 * Architecture:
 * - MainPanel handles the screen layout (data area, command input, menu bar)
 * - HyperFinTerminal manages the main loop, keybinding dispatch, and command execution
 * - Existing Menu/MenuOption/ActionHandler types are reused
 * - Output from actions is captured and displayed in the data area
 * - Chat mode uses ChatPanel for XMTP messaging
 */

import { Effect, pipe } from "effect";
import { Command } from "commander";
import { MainPanel, captureConsole, type PanelOption } from "./MainPanel.ts";
import {
  CommandState, CommandResultType, Menu, MenuOption,
  TerminalUserStateConfig, TerminalUserStateConfigContext,
} from "../types.ts";
import { Deferred } from "effect";
import { UnknownError } from "../errors/index.ts";
import { ChatPanel } from "./xmtp/ChatPanel.ts";
import chalk from "chalk";

/**
 * Wraps a commander program to execute a menu option's action and return the result.
 */
function executeAction(
  program: Command,
  menuOption: MenuOption,
  state: TerminalUserStateConfig,
  args: string[],
): Effect.Effect<CommandState, Error> {
  return Effect.gen(function* () {
    const deferred = yield* Deferred.make<CommandState, Error>();

    program
      .command(menuOption.command)
      .description(menuOption.description)
      .action(async (...actionArgs: any[]) => {
        const tusccService = Effect.provideService(
          TerminalUserStateConfigContext, state,
        );

        const actionEffect: Effect.Effect<void, unknown, never> = Effect.gen(function* () {
          const res = yield* menuOption.action(...actionArgs);
          yield* Deferred.succeed(deferred, res);
        }).pipe(tusccService);

        try {
          await Effect.runPromise(actionEffect);
        } catch (_error) {
          await Effect.runPromise(Deferred.fail(deferred, new UnknownError({ message: "An unknown failure occurred." })));
        }
      });

    yield* Effect.promise(() => program.parseAsync(args, { from: "user" }));
    return yield* Deferred.await(deferred);
  });
}

/**
 * Finds the best matching menu option for a typed command string.
 */
async function findMatchingOption(
  menuOptions: MenuOption[],
  input: string,
  state: TerminalUserStateConfig,
): Promise<{ option: MenuOption; result: CommandState } | null> {
  const args = input.split(/\s+/);

  for (const option of menuOptions) {
    const program = new Command();
    program.exitOverride();
    program.configureOutput({
      writeErr: () => {},
    });

    try {
      const result = await Effect.runPromise(
        executeAction(program, option, state, args),
      );
      return { option, result };
    } catch {
      continue;
    }
  }

  return null;
}

export interface HyperFinConfig {
  title: string;
  menu: Menu;
}

/**
 * HyperFinTerminal — the main TUI loop.
 */
export class HyperFinTerminal {
  private config: HyperFinConfig;
  private panel: MainPanel | null = null;
  private chatPanel: ChatPanel | null = null;
  private inChatMode: boolean = false;

  constructor(config: HyperFinConfig) {
    this.config = config;
  }

  /**
   * Start the HyperFin terminal loop.
   */
  async run(initialState: TerminalUserStateConfig): Promise<void> {
    let state = initialState;
    let currentMenu = this.config.menu;

    const buildPanelOptions = (menu: Menu): PanelOption[] => {
      const opts = menu.options(state);
      return opts.map((opt, i) => ({
        key: String(i + 1),
        label: opt.name,
        description: opt.description,
      }));
    };

    this.panel = new MainPanel({
      title: this.config.title,
      options: buildPanelOptions(currentMenu),
    });

    this.panel.init();
    this.panel.setData(["Welcome to HyperFin Terminal", "", "Press a number key to select a menu option, or type a command."]);
    this.panel.setStatus(chalk.dim(`${currentMenu.name} — ${currentMenu.description}`));
    this.panel.render();

    // Main event loop
    while (true) {
      if (this.inChatMode && this.chatPanel) {
        // Chat mode — delegate to ChatPanel
        const input = await this.panel.getInput();
        if (input.type === "key") {
          const handled = this.chatPanel.handleKey(input.key);
          if (!handled) {
            // Exit chat mode
            this.inChatMode = false;
            await this.chatPanel.destroy();
            this.chatPanel = null;
            this.panel.setCustomRenderer(null);
            this.panel.setData(["Chat session ended."]);
            this.panel.setStatus(chalk.dim(`${currentMenu.name} — ${currentMenu.description}`));
            this.panel.render();
          } else {
            // Re-render chat
            this.renderChat();
          }
        } else if (input.type === "command") {
          // In chat mode, treat typed text as chat input
          this.chatPanel.handleKey("TAB"); // switch to input mode
          for (const char of input.text) {
            this.chatPanel.handleKey(char);
          }
          this.chatPanel.handleKey("ENTER");
          this.renderChat();
        }
        continue;
      }

      // Normal mode
      const input = await this.panel.getInput();

      if (input.type === "key") {
        const idx = parseInt(input.key, 10) - 1;
        const options = currentMenu.options(state);

        if (idx >= 0 && idx < options.length) {
          const option = options[idx];

          // Check if this is the chat option
          if (option.name === "chat") {
            await this.enterChatMode();
            continue;
          }

          this.panel.setStatus(chalk.yellow(`Running: ${option.name}...`));
          this.panel.render();

          const { getOutput, result } = captureConsole(async () => {
            const program = new Command();
            program.exitOverride();
            program.configureOutput({ writeErr: () => {} });

            try {
              const cmdResult = await Effect.runPromise(
                executeAction(program, option, state, []),
              );
              return cmdResult;
            } catch (err) {
              return null;
            }
          });

          const cmdResult = await result;
          const output = getOutput();

          if (output) {
            this.panel.setData(output.split("\n"));
          } else {
            this.panel.setData([chalk.green(`✓ ${option.name} completed`)]);
          }

          if (cmdResult) {
            state = cmdResult.state;

            if (cmdResult.result.type === CommandResultType.Exit) {
              this.panel.destroy();
              return;
            }

            if (cmdResult.result.type === CommandResultType.Back) {
              currentMenu = this.config.menu;
              this.panel.setOptions(buildPanelOptions(currentMenu));
              this.panel.setStatus(chalk.dim(`${currentMenu.name} — ${currentMenu.description}`));
            }
          }

          this.panel.setStatus(chalk.dim(`${currentMenu.name} — ${currentMenu.description}`));
          this.panel.render();
        }
      } else if (input.type === "command") {
        this.panel.setStatus(chalk.yellow(`Running: ${input.text}...`));
        this.panel.render();

        const { getOutput, result } = captureConsole(async () => {
          const match = await findMatchingOption(
            currentMenu.options(state),
            input.text,
            state,
          );
          return match;
        });

        const match = await result;
        const output = getOutput();

        if (match) {
          if (output) {
            this.panel.setData(output.split("\n"));
          } else {
            this.panel.setData([chalk.green(`✓ ${match.option.name} completed`)]);
          }

          state = match.result.state;

          if (match.result.result.type === CommandResultType.Exit) {
            this.panel.destroy();
            return;
          }

          if (match.result.result.type === CommandResultType.Back) {
            currentMenu = this.config.menu;
            this.panel.setOptions(buildPanelOptions(currentMenu));
          }
        } else {
          this.panel.setData([
            chalk.red(`Unknown command: ${input.text}`),
            "",
            "Available commands:",
            ...currentMenu.options(state).map(o => `  ${o.command} — ${o.description}`),
          ]);
        }

        this.panel.setStatus(chalk.dim(`${currentMenu.name} — ${currentMenu.description}`));
        this.panel.render();
      }
    }
  }

  /**
   * Enter XMTP chat mode.
   */
  private async enterChatMode(): Promise<void> {
    if (!this.panel) return;

    this.chatPanel = new ChatPanel();
    this.chatPanel.setOnExit(() => {
      this.inChatMode = false;
    });

    this.panel.setStatus(chalk.yellow("Connecting to XMTP..."));
    this.panel.render();

    await this.chatPanel.init();

    this.inChatMode = true;

    // Set up custom renderer for chat mode
    this.panel.setCustomRenderer((dataAreaHeight: number) => {
      if (this.chatPanel) {
        return this.chatPanel.render(dataAreaHeight);
      }
      return [];
    });

    this.renderChat();
  }

  /**
   * Render the chat UI.
   */
  private renderChat(): void {
    if (!this.panel) return;
    this.panel.render();
  }
}
