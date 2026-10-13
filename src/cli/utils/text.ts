import { wordWrap } from "npm:@termuijs/core";

/**
 * Text helpers for command output.
 *
 * The shell's log truncates a long line at the pane edge rather than wrapping
 * it, so anything longer than the screen has to be wrapped here to be readable.
 */

/** Characters of a market's description worth printing before it swallows the screen. */
export const DESCRIPTION_LIMIT = 400;

/**
 * Flatten text to one paragraph and cut it to `limit` characters, marking the
 * cut with an ellipsis.
 *
 * A polymarket description is the market's resolution rules — often a couple of
 * thousand characters across a dozen lines — and printed whole it buries the
 * tables that follow it. The newlines are collapsed so the result reads as one
 * clean paragraph in the log.
 */
export const clampText = (text: string, limit: number): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  return flat.slice(0, limit).trimEnd() + " \u2026";
};

/** The width command output should be wrapped to: the terminal's, or a fallback. */
export const outputWidth = (fallback = 100): number => {
  const columns = process.stdout.columns;
  return typeof columns === "number" && columns > 0 ? columns : fallback;
};

/**
 * Wrap text to `width` columns.
 *
 * The log does not wrap, it cuts: a description printed as one line loses
 * everything past the pane edge with no sign that anything is missing.
 */
export const wrapText = (text: string, width: number): string[] =>
  wordWrap(text, Math.max(1, width)).split("\n");
