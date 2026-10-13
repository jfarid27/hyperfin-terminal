/**
 * First-word completion for the shell's input.
 *
 * Pure: the shell hands over the current menu's commands and applies the
 * result, so the behaviour can be tested without a terminal.
 */

export interface Completion {
  /** The text the input should end up holding. */
  value: string;
  /** Every command the typed prefix matched, in menu order. */
  candidates: readonly string[];
  /** More than one candidate matched, so the shell can list them. */
  ambiguous: boolean;
}

/** The longest string every value starts with. */
const commonPrefix = (values: readonly string[]): string => {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (const value of values) {
    while (!value.toLowerCase().startsWith(prefix.toLowerCase())) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return "";
    }
  }
  return prefix;
};

/**
 * Complete the **first word** of `input` against `commands`.
 *
 * Returns undefined when there is nothing to do: an empty line, a line that
 * already has arguments (only the command itself is completed), or a prefix no
 * command matches.
 *
 * With more than one match the rule is bash's: the word is extended to the
 * candidates' longest common prefix, or to the first candidate when the prefix
 * cannot grow any further. `ambiguous` marks the case worth listing, and the
 * shell walks the candidates with `cycleCompletion`.
 */
export const completeFirstWord = (
  input: string,
  commands: readonly string[],
): Completion | undefined => {
  if (!input || /\s/.test(input)) return undefined;

  const typed = input.toLowerCase();
  const matches = commands.filter((command) =>
    command.toLowerCase().startsWith(typed)
  );
  if (matches.length === 0) return undefined;
  if (matches.length === 1) {
    return { value: matches[0], candidates: matches, ambiguous: false };
  }

  const prefix = commonPrefix(matches);
  return {
    value: prefix.length > input.length ? prefix : matches[0],
    candidates: matches,
    ambiguous: true,
  };
};

/**
 * The candidate after `current`, wrapping around, for a repeat tab.
 *
 * Returns undefined when there is nothing to cycle (fewer than two candidates,
 * or the word is not standing on one of them) — which is why the *shell* holds
 * the cycle: a word that already is a candidate matches only itself, so no
 * stateless rule can advance from it.
 */
export const cycleCompletion = (
  candidates: readonly string[],
  current: string,
): string | undefined => {
  if (candidates.length < 2) return undefined;
  const standing = candidates.findIndex((candidate) =>
    candidate.toLowerCase() === current.toLowerCase()
  );
  if (standing === -1) return undefined;
  return candidates[(standing + 1) % candidates.length];
};

/** The first word of every command, deduplicated, in menu order. */
export const commandWords = (
  commands: readonly string[],
): string[] => [...new Set(commands.map((command) => command.split(/\s+/)[0]))];
