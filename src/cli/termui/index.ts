import type { Menu, TerminalUserStateConfig } from "../types.ts";
import { startTermuiShell } from "./app.ts";

export { startTermuiShell } from "./app.ts";
export { createMenuSession } from "./session.ts";
export type { MenuSession, Submission, SubmissionKind } from "./session.ts";
export {
  APP_ROOT_SEGMENT,
  caretPathSegments,
  caretPathWidth,
  menuPathSegment,
  menuPathSegments,
  PATH_SEPARATOR,
} from "./path.ts";
export { menuHeading, menuRows } from "./menu_view.ts";
export { captureOutput, toLines } from "./capture.ts";

/**
 * Whether the full-screen shell can run here.
 *
 * The shell draws into the alternate screen and reads raw keystrokes, so it
 * needs a real terminal on both ends. Piped input (scripts, e2e helpers, cron)
 * has no terminal to restore afterwards and must stay on the classic loop.
 */
export const canRunTermui = (): boolean =>
  Deno.stdin.isTerminal() && Deno.stdout.isTerminal();

/**
 * Run the application in the termui shell.
 *
 * Returns the shell's exit code. Callers must check {@link canRunTermui}
 * first — this does not silently degrade, because a half-started full-screen
 * app is worse than a clear refusal.
 */
export const startTermuiApp = async (
  rootMenu: Menu,
  state: TerminalUserStateConfig,
): Promise<number> => {
  if (!canRunTermui()) {
    throw new Error(
      "termui mode needs an interactive terminal (stdin and stdout must both be a TTY).",
    );
  }
  return await startTermuiShell(rootMenu, state);
};
