import chalk from "chalk";
import { splitGraphemes, stringWidth, stripAnsi, wordWrap } from "npm:@termuijs/core";
import { stripOsc } from "./links.ts";

/**
 * Plain-text table rendering.
 *
 * This replaces `terminal-kit`'s `terminal.table`. It writes aligned text with
 * ANSI colours rather than terminal-kit's own markup, which matters for two
 * reasons:
 *
 * - The output lands in the termui shell's log, which captures stdout and
 *   strips escape sequences. Colours drop out there, but the box and the column
 *   alignment — computed on *visible* width — survive intact.
 * - terminal-kit markup cannot be measured with the frame's own width table, so
 *   a cell's padding could disagree with its rendered width. ANSI is measured
 *   with `stripAnsi` + `stringWidth`, and OSC 8 hyperlinks with `stripOsc`
 *   first — the width table counts a hyperlink's escape bytes as characters, so
 *   an un-stripped link would pad its cell against the wrong length.
 *
 * The option names mirror terminal-kit's so existing call sites read the same.
 */

/** Styling for a cell or border, named the way terminal-kit named it. */
export interface TableAttr {
  color?: string;
  bgColor?: string;
}

export interface TableOptions {
  /** Draw the box border. Default: false. */
  hasBorder?: boolean;
  /** Border glyph set. Only "lightRounded" is defined; anything else falls back to it. */
  borderChars?: string;
  /** Border colour. */
  borderAttr?: TableAttr;
  /** Style applied to body cells, on top of any ANSI a cell already carries. */
  textAttr?: TableAttr;
  /** Style applied to the first row (the header). */
  firstRowTextAttr?: TableAttr;
  /**
   * Accepted for call-site compatibility and ignored: cells carry ANSI now,
   * which the renderer measures directly, so there is no markup pass.
   */
  contentHasMarkup?: boolean;
  /** Stretch the table to `width`. */
  fit?: boolean;
  /** Target total width in columns. */
  width?: number;
  /** Accepted and ignored: no caller limits rows today. */
  height?: number;
}

const BORDER = {
  topLeft: "\u256D",
  topRight: "\u256E",
  bottomLeft: "\u2570",
  bottomRight: "\u256F",
  horizontal: "\u2500",
  vertical: "\u2502",
  topTee: "\u252C",
  bottomTee: "\u2534",
  leftTee: "\u251C",
  rightTee: "\u2524",
  cross: "\u253C",
} as const;

/** One space of padding either side of a bordered cell. */
const CELL_PADDING = 2;
/** Narrowest a column may be squeezed to before content is truncated. */
const MIN_COLUMN_WIDTH = 4;

/**
 * A cell's visible text: colour and hyperlink escapes removed.
 *
 * Both have to go before measuring — `stringWidth` counts escape bytes as
 * columns, so a styled or hyperlinked cell would be padded against a length
 * that is not what the terminal draws.
 */
const visibleText = (cell: string): string => stripOsc(stripAnsi(cell));

/** The columns a cell's visible text occupies. */
const visibleWidth = (cell: string): number => stringWidth(visibleText(cell));

/**
 * Render rows as aligned lines.
 *
 * `maxWidth` caps the result at what the caller's surface can actually show —
 * the shell passes the terminal width so a 120-column table does not run off a
 * narrow screen. Columns give up width before any cell is truncated, widest
 * first.
 */
export const renderTable = (
  rows: readonly (readonly unknown[])[],
  options: TableOptions = {},
  maxWidth?: number,
): string[] => {
  if (rows.length === 0) return [];

  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (columns === 0) return [];

  const hasBorder = options.hasBorder ?? false;
  const cells = rows.map((row) =>
    Array.from({ length: columns }, (_, j) => cellText(row[j]))
  );

  // Natural width: the widest visible cell in each column.
  const widths = Array.from({ length: columns }, (_, j) =>
    cells.reduce((max, row) => Math.max(max, visibleWidth(row[j])), 0)
  );

  const frame = (w: readonly number[]): number =>
    hasBorder
      ? w.reduce((sum, x) => sum + x, 0) + 3 * columns + 1
      : w.reduce((sum, x) => sum + x, 0) + 2 * (columns - 1);

  const natural = frame(widths);
  let target = options.fit && options.width ? options.width : natural;
  if (maxWidth !== undefined && maxWidth > 0) target = Math.min(target, maxWidth);

  if (target > natural) {
    const share = Math.floor((target - natural) / columns);
    const remainder = (target - natural) % columns;
    for (let j = 0; j < columns; j++) {
      widths[j] += share + (j < remainder ? 1 : 0);
    }
  } else if (target < natural) {
    // Take the width back off the widest column first, so narrow columns such
    // as a strike price keep their full text for as long as possible.
    while (frame(widths) > target && Math.max(...widths) > MIN_COLUMN_WIDTH) {
      const widest = widths.indexOf(Math.max(...widths));
      widths[widest] -= 1;
    }
  }

  const color = options.borderAttr?.color;
  const bar = (text: string) => paint(text, undefined, color);
  const rule = (left: string, tee: string, right: string) =>
    bar(
      left +
        widths.map((w) => BORDER.horizontal.repeat(w + CELL_PADDING)).join(tee) +
        right,
    );

  const lines: string[] = [];
  if (hasBorder) lines.push(rule(BORDER.topLeft, BORDER.topTee, BORDER.topRight));

  cells.forEach((row, index) => {
    const attr = index === 0
      ? options.firstRowTextAttr
      : options.textAttr;

    // A cell too wide for its column wraps onto more lines rather than losing
    // text — a truncated description is data the reader can no longer see.
    const wrapped = row.map((cell, j) => wrapCell(cell, widths[j]));
    const rowHeight = wrapped.reduce(
      (max, cellLines) => Math.max(max, cellLines.length),
      1,
    );

    for (let k = 0; k < rowHeight; k++) {
      const rendered = row.map((_, j) => {
        const text = wrapped[j][k] ?? "";
        const padding = Math.max(0, widths[j] - visibleWidth(text));
        return " " + paint(text + " ".repeat(padding), attr?.bgColor) + " ";
      });
      lines.push(
        hasBorder
          ? bar(BORDER.vertical) + rendered.join(bar(BORDER.vertical)) +
            bar(BORDER.vertical)
          : rendered.join("  ").trimEnd(),
      );
    }

    if (index === 0 && cells.length > 1) {
      lines.push(rule(BORDER.leftTee, BORDER.cross, BORDER.rightTee));
    }
  });

  if (hasBorder) {
    lines.push(rule(BORDER.bottomLeft, BORDER.bottomTee, BORDER.bottomRight));
  }
  return lines;
};

/**
 * A cell as text.
 *
 * Call sites hand over whatever the data holds — the polymarket `market`
 * command passes `[true, 112539.6954, 443844.6077500001]` — and every cell is
 * measured with the width table, which works on strings. Anything that is not
 * one is stringified here, rather than blowing up mid-render (`str.replace is
 * not a function`). A missing cell is empty, which is how a ragged row reads.
 */
const cellText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
};

/**
 * Break a cell into the lines it needs to fit `width`.
 *
 * A cell that fits is returned untouched, ANSI and all. One that does not is
 * stripped of colour first — wrapping a string mid-escape would leave the
 * terminal in whatever state the truncated sequence implied — then wrapped at
 * word boundaries, with a grapheme-wise split for a word longer than the column
 * so the box cannot be pushed out of shape.
 */
const wrapCell = (cell: string, width: number): string[] => {
  const visible = visibleText(cell);
  if (stringWidth(visible) <= width) return [cell];
  if (width <= 0) return [""];

  const out: string[] = [];
  for (const line of wordWrap(visible, width).split("\n")) {
    if (stringWidth(line) <= width) {
      out.push(line);
      continue;
    }
    const chars = splitGraphemes(line);
    let current = "";
    for (const char of chars) {
      if (stringWidth(current + char) > width) {
        out.push(current);
        current = char;
      } else {
        current += char;
      }
    }
    out.push(current);
  }
  return out.length > 0 ? out : [""];
};

/**
 * Render and print a table — the drop-in for `terminal.table`.
 *
 * Prints through `console.log`, deliberately: the shell's output capture
 * intercepts the console, while the frame renderer writes straight to the
 * process stream. Writing to the stream here would make a command's table
 * indistinguishable from a frame — see `termui/capture.ts`.
 */
export const table = (
  rows: readonly (readonly unknown[])[],
  options: TableOptions = {},
): void => {
  const terminalWidth = process.stdout.columns;
  const lines = renderTable(
    rows,
    options,
    typeof terminalWidth === "number" ? terminalWidth : undefined,
  );
  console.log(lines.join("\n"));
};

/**
 * Apply a named colour, or pass the text through for "default"/unknown names.
 * chalk reports no colour support outside a TTY, so a piped run and the tests
 * get plain text.
 */
const paint = (
  text: string,
  background?: string,
  foreground?: string,
): string => {
  const fg = colorFn(foreground);
  const bg = colorFn(background, "bg");
  return bg(fg(text));
};

const colorFn = (
  name?: string,
  kind: "fg" | "bg" = "fg",
): ((text: string) => string) => {
  const identity = (text: string) => text;
  if (!name || name === "default") return identity;
  const key = kind === "bg"
    ? `bg${name.charAt(0).toUpperCase()}${name.slice(1)}`
    : name;
  const fn = (chalk as unknown as Record<string, unknown>)[key];
  return typeof fn === "function"
    ? (fn as (text: string) => string).bind(chalk)
    : identity;
};
