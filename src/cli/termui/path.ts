import { stringWidth } from "npm:@termuijs/core";
import type { Menu } from "../types.ts";

/** Head of every prompt path — the application itself. */
export const APP_ROOT_SEGMENT = "hyperfin";

/**
 * Separator drawn between path segments.
 *
 * Plain `>` rather than a pretty arrow on purpose. The renderer's width table
 * counts the decorative arrows (`❯` U+276F, `❱` U+2771) as *two* columns while
 * terminals — tmux included — paint them as one, and the renderer writes a
 * row's changed span cell-by-cell while skipping continuation cells. The
 * mismatch shifts everything after a separator one column left, which drags
 * the input box off the right edge of the terminal. An ASCII separator can
 * never disagree with the terminal about its width.
 */
export const PATH_SEPARATOR = ">";

/**
 * The prompt's caret path: the app name followed by every menu currently on
 * the navigation stack, outermost first.
 *
 * `[Main Menu]` → `["hyperfin", "main"]`, and once the user has walked into
 * stocks then technicals → `["hyperfin", "stocks", "technicals"]`.
 */
export const menuPathSegments = (stack: readonly Menu[]): string[] => [
  APP_ROOT_SEGMENT,
  ...stack.map(menuPathSegment),
];

/**
 * A menu's short, path-friendly name: `"Crypto Menu"` → `"crypto"`.
 * A menu whose name carries no "menu" suffix keeps its whole name.
 */
export const menuPathSegment = (menu: Menu): string => {
  const trimmed = menu.name.replace(/\s*menu\s*$/i, "").trim();
  return (trimmed || menu.name).toLowerCase();
};

/**
 * Path segments with a trailing empty one, so the rendered path ends in a
 * separator — that trailing separator *is* the caret sitting at the prompt,
 * e.g. `hyperfin ❯ stocks ❯ technicals ❯`.
 *
 * Breadcrumbs draws a separator *between* segments only, so the empty final
 * segment is what earns the trailing one.
 */
export const caretPathSegments = (stack: readonly Menu[]): string[] => [
  ...menuPathSegments(stack),
  "",
];

/**
 * Rendered width of a caret path plus the gap before the input box.
 *
 * The bottom bar sizes the path with an exact-length layout constraint, so
 * this has to match what Breadcrumbs actually draws — same separator, same
 * spacing (one column of padding is added for the gap to the input).
 */
export const caretPathWidth = (
  segments: readonly string[],
  separator: string = PATH_SEPARATOR,
): number => stringWidth(segments.join(` ${separator} `)) + 1;
