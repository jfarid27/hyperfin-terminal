/**
 * Terminal hyperlinks (OSC 8) and the helpers that keep them measurable.
 *
 * A URL printed on its own is only clickable if the terminal happens to detect
 * URLs on screen. Wrapping the text in an OSC 8 hyperlink asks for the link
 * explicitly, so a terminal that supports hyperlinks (kitty, ghostty, wezterm,
 * alacritty) makes it clickable wherever the text appears.
 *
 * Two rules make that safe to print anywhere:
 *
 * - The escape is only emitted when stdout is a terminal. Redirected or piped
 *   output stays plain text, so nothing downstream has to parse control bytes.
 * - The visible label is always the URL itself. An escape sequence that is
 *   dropped (the termui shell strips OSC from captured commands — its screen
 *   buffer's `writeString` runs `stripAnsiControl`) still leaves the reader the
 *   whole URL to read or copy.
 *
 * Because the escape carries no columns, anything that *measures* text has to
 * remove it first — see `stripOsc` and `renderTable`.
 */

/**
 * OSC (Operating System Command) sequences: hyperlinks, window titles,
 * clipboard writes. Terminated by BEL or ST (`ESC \`).
 */
export const OSC_SEQUENCES = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g;

/**
 * Wrap `label` in an OSC 8 hyperlink pointing at `url`.
 *
 * Pure and unconditional: the caller decides whether this terminal can use a
 * hyperlink (see `hyperlink`). The result must never be measured directly —
 * `stringWidth` counts the escape bytes as characters.
 */
export const renderHyperlink = (url: string, label: string = url): string =>
  `\u001B]8;;${url}\u001B\\${label}\u001B]8;;\u001B\\`;

/**
 * `url` as clickable text where the terminal supports hyperlinks, plain text
 * everywhere else.
 *
 * The escape is dropped whenever stdout is not a terminal so a redirected run
 * (`deno task cli < script.txt > out.txt`, the e2e harness, a script probe)
 * carries no control bytes.
 *
 * Use this where the link is drawn as a single measured unit — a table cell.
 * A *wrapped* prose line must carry the plain URL instead (`linkLines`): the
 * wrapper counts graphemes, so it would slice the escape sequence itself and
 * leave the terminal in a half-open hyperlink.
 */
export const hyperlink = (url: string, label: string = url): string =>
  isTerminal() ? renderHyperlink(url, label) : label;

/**
 * Remove OSC sequences, leaving the visible text.
 *
 * Required before any width measurement: the termui width table counts an OSC
 * 8 link as its own characters, so a hyperlinked cell would be padded against
 * the wrong length and the box would come out crooked.
 */
export const stripOsc = (text: string): string => text.replace(OSC_SEQUENCES, "");

/** Whether stdout is a terminal, guarded for hosts without `Deno.stdout`. */
export const isTerminal = (): boolean => {
  try {
    return Deno.stdout.isTerminal();
  } catch {
    return false;
  }
};
