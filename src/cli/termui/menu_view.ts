import type { Menu, MenuOption } from "../types.ts";

/** Column gaps in the rendered option table. */
const COLUMN_GAP = 2;

/**
 * Render a menu's options as aligned plain-text rows.
 *
 * The shell's log view takes strings, so the table is laid out here rather
 * than handed to a table widget. That is also why every cell is plain text:
 * the renderer writes cells with its own markup, and chalk ANSI inside a cell
 * is known to leak through as literal escape text.
 */
export const menuRows = (options: readonly MenuOption[]): string[] => {
  const nameWidth = maxWidth(options.map((option) => option.name));
  const commandWidth = maxWidth(options.map((option) => option.command));

  return options.map((option) =>
    [
      pad(option.name, nameWidth),
      pad(option.command, commandWidth),
      option.description,
    ].join(" ".repeat(COLUMN_GAP)).trimEnd()
  );
};

/**
 * The heading drawn above a menu's rows, so a path shown in the prompt can be
 * traced back through the scrollback.
 */
export const menuHeading = (menu: Menu, depth: number): string =>
  `${"  ".repeat(Math.max(0, depth - 1))}${menu.name}`;

const maxWidth = (values: readonly string[]): number =>
  values.reduce((max, value) => Math.max(max, value.length), 0);

const pad = (value: string, width: number): string =>
  width > value.length ? value.padEnd(width) : value;
