import { Constraint, invalidateLayout, LengthConstraint } from "npm:@termuijs/core";
import { Box, Breadcrumbs, LogView, Text, TextInput } from "npm:@termuijs/widgets";
import type { Widget } from "npm:@termuijs/widgets";
import { PATH_SEPARATOR } from "./path.ts";

const CYAN = { type: "named", name: "cyan" } as const;
const BRIGHT_CYAN = { type: "named", name: "brightCyan" } as const;
const DIM = { type: "named", name: "brightBlack" } as const;

/** Height of the bottom input bar: one text row inside a single-line border. */
export const INPUT_BAR_HEIGHT = 3;

export interface ShellWidgets {
  root: Box;
  header: Text;
  log: LogView;
  hint: Text;
  bar: Box;
  crumbs: Breadcrumbs;
  input: TextInput;
}

export interface ShellLayoutOptions {
  /** Path segments the prompt starts with; the caret path ends in a separator. */
  pathSegments: string[];
  /** Exact width the prompt may occupy in the bottom bar. */
  promptWidth: number;
  /** Called with the input's value when the user presses enter. */
  onSubmit: (value: string) => void;
  /** Called when the user presses tab, to complete what is typed. */
  onTab: () => void;
}

/**
 * Build the shell's widget tree: a content log above, one input bar below.
 *
 * Two layout rules are load-bearing here, both of which fail *silently* if
 * broken — a widget simply renders nothing:
 *
 * - On a column's main axis a child with no stated size collapses to zero, so
 *   the header says `height: 1` and the log takes the leftover rows with
 *   `flexGrow`.
 * - The bottom bar sizes its children with constraints rather than flex, so
 *   the prompt gets exactly the columns its text needs and the input box fills
 *   the rest — which is what keeps the text box full width at any terminal
 *   size. `applyPromptWidth` restates that as the path grows and shrinks.
 */
export const buildShellLayout = (options: ShellLayoutOptions): ShellWidgets => {
  const root = new Box({
    flexDirection: "column",
    width: "100%",
    height: "100%",
  });

  const header = new Text(" HYPERFIN TERMINAL", {
    height: 1,
    fg: BRIGHT_CYAN,
    bold: true,
  });

  // `autoScroll` is off: the shell drives the scroll position itself, so that
  // scrolling back into history is not undone by the next line a command
  // prints. Following the tail is re-applied after every append while the view
  // is in follow mode (see `app.ts`).
  const log = new LogView(
    { flexGrow: 1, width: "100%" },
    { autoScroll: false, maxLines: 5000 },
  );

  // One row of keys, so the log's scrolling is discoverable. ASCII only: the
  // arrows (↑ ↓) are East Asian Ambiguous, and the renderer's width table
  // counts them as two columns while a terminal paints one — the same trap the
  // prompt separator hit.
  const hint = new Text(
    "  up/down scroll | PgUp/PgDn page | Tab complete | Ctrl-G follow | Ctrl-X quit",
    { height: 1, fg: DIM },
  );

  const bar = new Box({
    flexDirection: "row",
    height: INPUT_BAR_HEIGHT,
    width: "100%",
    constraints: [
      Constraint.Length(options.promptWidth),
      Constraint.Fill(1),
    ],
  });

  // Segments end in an empty one so the path closes with a separator: that
  // trailing caret is where the user types.
  const crumbs = new Breadcrumbs(
    options.pathSegments,
    { padding: { right: 1 } },
    { separator: PATH_SEPARATOR, activeColor: BRIGHT_CYAN },
  );

  const input = new TextInput(
    {
      border: "single",
      borderColor: DIM,
      focusRingColor: CYAN,
      focusRingStyle: "border",
    },
    {
      placeholder: "type a command…",
      onSubmit: options.onSubmit,
    },
  );

  bar.addChild(crumbs);
  bar.addChild(input);
  root.addChild(header);
  root.addChild(log);
  root.addChild(hint);
  root.addChild(bar);

  // The frame names the space bar "space" (InputParser maps byte 0x20 to that
  // name), while TextInput only inserts a key when it is a single grapheme — so
  // every space is silently dropped and a parameterised command such as
  // `spot AAPL` cannot be typed at all. Insert it here instead. The widget's own
  // handler runs first and leaves a key it did not handle unstopped, so this
  // still sees the event.
  input.events.on("key", (event) => {
    if (event.key === "space") {
      input.insertChar(" ");
      event.stopPropagation();
    }
  });

  // Tab never reaches a handler of ours: TextInput claims it and calls its own
  // `acceptSuggestion`, which can only ever match suggestions fixed at
  // construction — and the shell's candidates change with the menu. So plug the
  // completion in where the widget goes looking for it. `getSuggestions` is left
  // alone: with the input one row tall the widget draws no suggestion list
  // anyway, and the shell prints the candidates into the log instead.
  input.acceptSuggestion = () => options.onTab();

  return { root, header, log, hint, bar, crumbs, input };
};

/**
 * Restate how much of the bottom bar the prompt may take.
 *
 * Called whenever the menu path changes. `setStyle` marks the bar dirty, which
 * is what makes the next layout pass re-run the bar's constraints.
 *
 * Returns whether the width actually changed, so a caller can skip the repaint
 * a no-op change would otherwise force.
 */
export const applyPromptWidth = (bar: Box, width: number): boolean => {
  const [first] = bar.style.constraints ?? [];
  if (first instanceof LengthConstraint && first.value === width) {
    return false;
  }
  bar.setStyle({
    constraints: [Constraint.Length(width), Constraint.Fill(1)],
  });

  // Flag the layout path from the root down to the bar. `setStyle` calls
  // `markDirty`, which returns early when the widget is *already* dirty, and
  // even when it runs it only flags the widget's own layout node — while the
  // layout engine bails out at the first node it finds unchanged. Flagging
  // every ancestor is what guarantees the bar's new constraints are re-run.
  let top: Widget = bar;
  while (top.parent) top = top.parent;
  invalidateLayout(top.getLayoutNode());

  return true;
};
