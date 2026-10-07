/**
 * terminal-kit table markup helpers.
 *
 * terminal-kit renders cell text with its *own* markup (`^+bold^:`, `^g…^:`,
 * `^r…^:`). chalk emits ANSI escape sequences (`\u001b[1m…\u001b[22m`) instead,
 * and when chalk-formatted text is placed in a table cell terminal-kit strips
 * the ESC byte but leaves the literal `[1m`/`[22m` behind — so the cell shows
 * " [1mTSMC34.SAO [22m" instead of the symbol. Never put chalk output in a
 * table cell; use these helpers with `contentHasMarkup: true`.
 */

/** Escape `^`, terminal-kit's markup metacharacter, in untrusted text. */
export const escapeTableMarkup = (text: string): string =>
  text.replace(/\^/g, "^^");

/** A bold table cell. */
export const boldCell = (text: string): string =>
  `^+${escapeTableMarkup(text)}^:`;

/** A green table cell. */
export const greenCell = (text: string): string =>
  `^g${escapeTableMarkup(text)}^:`;

/** A red table cell. */
export const redCell = (text: string): string =>
  `^r${escapeTableMarkup(text)}^:`;
