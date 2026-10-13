/**
 * Capturing a command's output while the TUI owns the screen.
 *
 * Only the **console** is intercepted, never `process.stdout`. Every command
 * writes through the console — including `table()`, which prints with
 * `console.log` — whereas the frame renderer writes straight to the process
 * stream (`Terminal.writeSync` → `stdout.write`). Patching the stream would
 * also capture the app's own frames: the screen would freeze for the length of
 * every command, and a command slower than one frame would pour screen dumps
 * into the log.
 *
 * Captured text is stripped of control sequences and handed back as plain
 * lines for the log view.
 */

/** ANSI/DEC escape sequences: SGR colors, cursor moves, OSC titles, etc. */
const ESCAPE_SEQUENCES =
  /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/** Remaining C0 control bytes, keeping newlines out of it. */
const CONTROL_BYTES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Flatten captured writes into printable lines.
 *
 * Cursor-positioning sequences are removed rather than interpreted, so a table
 * drawn by moving the cursor around arrives as its cell text in write order,
 * one row per line where the writer emitted a newline. That is readable for
 * single-row output and lossy for heavy cursor drawing — the reason the menu
 * listing is rendered by this module rather than by a command's own table code.
 */
export const toLines = (raw: string): string[] =>
  raw
    .replace(ESCAPE_SEQUENCES, "")
    .replace(CONTROL_BYTES, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.length > 0);

export type CapturedOutput<T> =
  | { ok: true; lines: string[]; value: T }
  | { ok: false; lines: string[]; failure: unknown };

/**
 * Run `run` with stdout and the console methods redirected into a buffer.
 *
 * Always reports the captured lines, including when `run` throws: a command
 * that fails still printed something useful first (commander's arity and
 * usage errors are written before it throws), and the caller wants both the
 * output and the failure. Restoration happens in a `finally`, so a throwing
 * command cannot leave stdout hijacked.
 */
export const captureOutput = async <T>(
  run: () => Promise<T>,
): Promise<CapturedOutput<T>> => {
  const chunks: string[] = [];
  const write = (chunk: unknown) => {
    chunks.push(typeof chunk === "string" ? chunk : String(chunk));
    return true;
  };

  // The original property is kept (not a bound copy) so restoring puts the
  // exact same function back, which is what callers and tests compare against.
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  console.log = (...args: unknown[]) => void write(formatArgs(args));
  console.info = (...args: unknown[]) => void write(formatArgs(args));
  console.warn = (...args: unknown[]) => void write(formatArgs(args));
  console.error = (...args: unknown[]) => void write(formatArgs(args));
  console.debug = (...args: unknown[]) => void write(formatArgs(args));

  try {
    // Run first, then read the buffer: an object literal evaluates its values
    // in order, so computing `lines` beside the call would read the buffer
    // before the command had written anything to it.
    const value = await run();
    return { ok: true, lines: toLines(chunks.join("")), value };
  } catch (failure) {
    return { ok: false, lines: toLines(chunks.join("")), failure };
  } finally {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  }
};

/** console.log-alike formatting for intercepted calls. */
const formatArgs = (args: readonly unknown[]): string =>
  args
    .map((arg) =>
      typeof arg === "string"
        ? arg
        : (() => {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        })()
    )
    .join(" ") + "\n";
