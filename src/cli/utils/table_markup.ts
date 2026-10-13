import chalk from "chalk";

/**
 * Cell styling for the text table renderer.
 *
 * These used to emit terminal-kit's markup (`^+bold^:`, `^g…^:`), because
 * terminal-kit stripped the ESC byte from chalk's output and left a literal
 * `[1m` in the cell. The renderer measures ANSI directly now (`stripAnsi` +
 * `stringWidth`), so cells can carry chalk output like anywhere else — and the
 * `^` escaping that markup needed is gone with it.
 */

/** A bold table cell. */
export const boldCell = (text: string): string => chalk.bold(text);

/** A green table cell. */
export const greenCell = (text: string): string => chalk.green(text);

/** A red table cell. */
export const redCell = (text: string): string => chalk.red(text);
