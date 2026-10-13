import type {
  Menu,
  MenuOption,
  TerminalUserStateConfig,
} from "../types.ts";
import { findMenuOption } from "../utils/menu_dispatch.ts";
import { caretPathSegments, caretPathWidth } from "./path.ts";
import { menuHeading, menuRows } from "./menu_view.ts";

/**
 * How an input line should be handled.
 *
 * - `empty`     — nothing to do.
 * - `navigate`  — the line names a submenu; the shell renders the child itself
 *                 instead of running the option, because the option's classic
 *                 action would enter the child's own blocking input loop.
 * - `dispatch`  — run the line through the shared commander pipeline.
 * - `unknown`   — the line names nothing on this menu. Reported as such rather
 *                 than handed to commander, whose override throws on an
 *                 unknown command and would take the whole shell down.
 */
export type SubmissionKind = "empty" | "navigate" | "dispatch" | "unknown";

export interface Submission {
  kind: SubmissionKind;
  /** The line as typed, trimmed. */
  input: string;
  /** Child menu to push, for `navigate`. */
  target?: Menu;
}

/**
 * The navigation model behind the shell's prompt: which menu the input bar is
 * pointed at, the path that got there, and how a typed line is classified.
 *
 * Deliberately free of widgets and terminal access so it can be exercised
 * without a TTY — the widget layer only renders what this reports.
 */
export interface MenuSession {
  readonly state: TerminalUserStateConfig;
  /** Menu the prompt currently points at (top of the stack). */
  current(): Menu;
  /** Navigation stack, outermost first. Always at least the root. */
  stack(): readonly Menu[];
  /** Depth of the navigation stack; the root menu counts as 1. */
  depth(): number;
  /** Options of the current menu for the current state. */
  options(): MenuOption[];
  /** Breadcrumb segments for the prompt, ending in the caret. */
  pathSegments(): string[];
  /** Exact prompt width for the bottom bar's layout constraint. */
  promptWidth(): number;
  /** Blocks to append to the log when a menu becomes current. */
  menuLines(): string[];
  /** Classify a typed line. */
  classify(input: string): Submission;
  /** Push a child menu onto the stack. */
  enter(menu: Menu): void;
  /** Pop one level; false when already at the root. */
  back(): boolean;
  /** Adopt state returned by a command. */
  setState(state: TerminalUserStateConfig): void;
  /**
   * Drop the script's current line: the next one becomes current, or the script
   * is left with none (which is how a script is known to be finished).
   */
  consumeScriptLine(): void;
  /** Forget the script context, leaving the rest of the state alone. */
  clearScript(): void;
  /** Return to the outermost menu. */
  resetToRoot(): void;
}

export const createMenuSession = (
  rootMenu: Menu,
  initialState: TerminalUserStateConfig,
): MenuSession => {
  const stack: Menu[] = [rootMenu];
  let state = initialState;

  const current = () => stack[stack.length - 1];
  const options = () => current().options(state);

  return {
    get state() {
      return state;
    },
    current,
    stack: () => [...stack],
    depth: () => stack.length,
    options,
    pathSegments: () => caretPathSegments(stack),
    promptWidth: () => caretPathWidth(caretPathSegments(stack)),
    menuLines: () => [
      "",
      menuHeading(current(), stack.length),
      ...menuRows(options()),
    ],
    classify: (raw) => {
      const input = raw.trim();
      if (!input) return { kind: "empty", input };

      const option = findMenuOption(options(), input);
      if (!option) return { kind: "unknown", input };

      // A bare submenu name hops into the child. With arguments (e.g.
      // `source massive`) it is a normal command on the current menu.
      const bareCommand = input.split(/\s+/).length === 1;
      if (option.submenu && bareCommand) {
        return { kind: "navigate", input, target: option.submenu() };
      }
      return { kind: "dispatch", input };
    },
    enter: (menu) => {
      stack.push(menu);
    },
    back: () => {
      if (stack.length <= 1) return false;
      stack.pop();
      return true;
    },
    setState: (next) => {
      state = next;
    },
    consumeScriptLine: () => {
      const script = state.scriptContext;
      if (!script) return;
      const [next, ...rest] = script.tailCommands ?? [];
      state = {
        ...state,
        scriptContext: { ...script, currentCommand: next, tailCommands: rest },
      };
    },
    clearScript: () => {
      state = { ...state, scriptContext: {} };
    },
    resetToRoot: () => {
      stack.length = 1;
    },
  };
};
