/**
 * Which keys and mouse gestures move the output log's viewport.
 *
 * Kept pure and separate from the shell: the widget layer only applies the
 * intent, so the mapping can be tested without a terminal.
 *
 * Only keys the input widget leaves alone ever reach here. It consumes the
 * horizontal arrows and Home/End for its own cursor, plus Tab and Ctrl-U/W —
 * but **not** the vertical arrows, the page keys, or a Ctrl combo it does not
 * use, so those bubble up to the shell.
 */

/** How a gesture moves the log: `lines` positive scrolls towards newer output. */
export interface LogScrollIntent {
  /** Lines to move by. */
  lines: number;
  /**
   * The following state to adopt, or undefined to leave it alone.
   *
   * Scrolling back into history stops the view following new output — otherwise
   * the next line a command prints would yank you to the bottom. Scrolling
   * forward leaves the state as it was, so a `↓` at the tail does not silently
   * drop out of follow mode.
   */
  follow?: boolean;
}

const TO_TAIL = Number.MAX_SAFE_INTEGER;

const page = (height: number): number => Math.max(1, height);

/**
 * Map a key press to a log scroll.
 *
 * `pageHeight` is the log's visible height, so a page key moves a screenful.
 */
export const logScrollIntent = (
  key: string,
  ctrl: boolean,
  pageHeight: number,
): LogScrollIntent | undefined => {
  switch (key) {
    case "up":
      return { lines: -1, follow: false };
    case "down":
      return { lines: 1 };
    case "pageup":
      return { lines: -page(pageHeight), follow: false };
    case "pagedown":
      return { lines: page(pageHeight) };
    case "g":
      // Ctrl-G jumps to the newest output and follows it again.
      return ctrl ? { lines: TO_TAIL, follow: true } : undefined;
    default:
      return undefined;
  }
};

/**
 * Map a mouse wheel event to a log scroll.
 *
 * Returns undefined for anything that is not a wheel scroll, so clicks and
 * drags are left to the widget layer.
 */
export const logScrollFromMouse = (
  event: { type?: string; scrollDelta?: number },
): LogScrollIntent | undefined => {
  if (event.type !== "scroll") return undefined;
  const delta = event.scrollDelta ?? 0;
  if (delta === 0) return undefined;
  // A wheel up (negative delta) reads backwards without leaving follow mode
  // *off* — the same rule as the arrow keys.
  return delta < 0
    ? { lines: delta, follow: false }
    : { lines: delta };
};
