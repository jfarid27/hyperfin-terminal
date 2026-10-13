import { App, computeLayout } from "npm:@termuijs/core";
import { Effect } from "effect";
import { CommandResultType, type Menu, type TerminalUserStateConfig } from "../types.ts";
import { dispatchMenuInput, findMenuOption, usageLine } from "../utils/menu_dispatch.ts";
import { claimInteractiveTerminal } from "../utils/program_loader.ts";
import { captureOutput } from "./capture.ts";
import { commandWords, completeFirstWord, cycleCompletion } from "./complete.ts";
import { logScrollFromMouse, logScrollIntent } from "./scroll.ts";
import { applyPromptWidth, buildShellLayout } from "./layout.ts";
import { createMenuSession } from "./session.ts";

const WELCOME = [
  "Hyperfin Terminal — type a command, \"back\" steps out of a menu, \"exit\" quits.",
];

/**
 * Mount the full-screen shell: a content log on top and one input bar pinned
 * to the bottom, whose prompt is the path of menus the user has walked into.
 *
 * Resolves with the exit code when the app unmounts.
 */
export const startTermuiShell = async (
  rootMenu: Menu,
  initialState: TerminalUserStateConfig,
): Promise<number> => {
  // The shell owns the terminal from here: the line-based menu loop must not
  // read stdin while this is up (see `claimInteractiveTerminal`).
  claimInteractiveTerminal();

  const session = createMenuSession(rootMenu, initialState);

  let submit: (raw: string) => void = () => {};
  const { root, log, bar, crumbs, input } = buildShellLayout({
    pathSegments: session.pathSegments(),
    promptWidth: session.promptWidth(),
    onSubmit: (value: string) => submit(value),
    // Deferred like `submit`: the completion helper is defined below and
    // closes over the widgets this call creates.
    onTab: () => completeInput(),
  });

  const app = new App(root, {
    fullscreen: true,
    fps: 30,
    mouse: true,
    title: "Hyperfin Terminal",
  });

  const drawPrompt = () => {
    crumbs.setSegments(session.pathSegments());
    // The path grows and shrinks as menus are pushed and popped, so the bar's
    // constraint is re-stated on every move; markDirty via setStyle is what
    // gets the new widths laid out.
    if (!applyPromptWidth(bar, session.promptWidth())) return;
    // Moving the input box leaves cells from its old position behind, because
    // the renderer only repaints what it can prove changed. Tell it the frame
    // it is holding is stale — the same thing App does for itself on a resize.
    app.screen.invalidate();
    app.requestRender();
  };

  /**
   * Whether the log is following new output.
   *
   * Scrolling back into history turns this off so a command's output cannot
   * yank the view away from what is being read; Ctrl-G (or submitting a
   * command) turns it back on.
   */
  let following = true;

  /** Append a line to the log, keeping the tail visible while following it. */
  const say = (line: string) => {
    log.appendLine(line);
    if (following) log.scrollDown(Number.MAX_SAFE_INTEGER);
  };

  /** Move the log's viewport by a scroll intent. */
  const scrollLog = (intent: { lines: number; follow?: boolean }) => {
    if (intent.follow !== undefined) following = intent.follow;
    if (intent.lines > 0) log.scrollDown(intent.lines);
    else if (intent.lines < 0) log.scrollUp(-intent.lines);
  };

  /**
   * The last completion we wrote, so a repeat tab can walk the candidates.
   *
   * The shell has to hold this: the input already holding a candidate means the
   * word matches only itself, so completion alone cannot tell "tab again" from
   * "tab on a word that happens to be a command".
   */
  let cycle: { written: string; candidates: readonly string[] } | null = null;

  /**
   * Complete the first word to a command of the current menu.
   *
   * Runs from the tab override `buildShellLayout` installs. Tab again without
   * touching the line walks the candidates — `s`, Tab, Tab, Tab at the main
   * menu gives `script`, `stocks`, `showconfig`, `script` — and an ambiguous
   * prefix is printed into the log, because the input box is a single row with
   * no room to draw a suggestion list.
   */
  const completeInput = () => {
    const typed = input.value;

    // Still standing on what the last tab wrote, with nothing typed since: step
    // through the candidates.
    if (cycle && cycle.written === typed) {
      const next = cycleCompletion(cycle.candidates, typed) ?? typed;
      input.value = next;
      input.moveCursorEnd();
      cycle.written = next;
      return;
    }

    const completion = completeFirstWord(
      typed,
      commandWords(session.options().map((option) => option.command)),
    );
    if (!completion) {
      cycle = null;
      return;
    }

    input.value = completion.value;
    input.moveCursorEnd();
    cycle = { written: completion.value, candidates: completion.candidates };

    // Listing the candidates is worth a line of its own; while cycling the user
    // is already being shown them one at a time.
    if (completion.ambiguous && completion.candidates.length > 1) {
      say(`matches: ${completion.candidates.join(", ")}`);
    }
  };

  const appendMenu = () => {
    for (const line of session.menuLines()) say(line);
  };

  submit = (raw: string) => {
    void handleSubmit(raw);
  };

  /**
   * Run one input line — navigate, dispatch, or report — and say how it ended,
   * so a script driver knows whether to keep going.
   */
  const processLine = async (
    raw: string,
  ): Promise<"ok" | "error" | "exit"> => {
    const submission = session.classify(raw);

    if (submission.kind === "empty") return "ok";

    say(`> ${submission.input}`);

    if (submission.kind === "navigate" && submission.target) {
      session.enter(submission.target);
      appendMenu();
      drawPrompt();
      return "ok";
    }

    if (submission.kind === "unknown") {
      say(`unknown command: ${submission.input} (see the list above)`);
      return "error";
    }

    // Run the line through the same commander/Effect pipeline the line loop
    // uses, with the console captured so the command's output lands in the log
    // instead of tearing the frame.
    const captured = await captureOutput(() =>
      Effect.runPromise(
        dispatchMenuInput(session.options(), submission.input, session.state),
      )
    );
    for (const line of captured.lines) say(line);
    if (!captured.ok) {
      // A line commander cannot parse (required argument missing, one word too
      // many): show the command's usage instead of a raw error.
      const option = findMenuOption(session.options(), submission.input);
      say(`  ${option ? usageLine(option) : "unknown command"}`);
      say(
        `  (${
          captured.failure instanceof Error
            ? captured.failure.message
            : String(captured.failure)
        })`,
      );
      return "error";
    }

    const result = captured.value;
    session.setState(result.state);

    if (result.result.type === CommandResultType.Exit) {
      app.exit(0);
      return "exit";
    }
    if (result.result.type === CommandResultType.Back) {
      if (!session.back()) {
        say("Already at the top menu.");
      }
      appendMenu();
      drawPrompt();
      return "ok";
    }
    if (result.result.type === CommandResultType.Error) {
      if (captured.lines.length === 0) {
        say(`invalid command: ${submission.input}`);
      }
      return "error";
    }
    drawPrompt();
    return "ok";
  };

  /**
   * Run the lines a `script` command recorded.
   *
   * The line loop drives `scriptContext` itself; the shell has no such loop, so
   * it runs the recorded lines here — one per menu level, in order — and lands
   * back on the main menu, which is where the line loop leaves an interactive
   * script too.
   */
  const runScript = async () => {
    const script = session.state.scriptContext;
    const pending = [script.currentCommand, ...(script.tailCommands ?? [])]
      .filter((line): line is string => Boolean(line));

    say(`Executing script: ${script.filename}`);

    let ending: "ok" | "error" | "exit" = "ok";
    for (const line of pending) {
      say(`Executing script command: ${line}`);
      session.consumeScriptLine();
      ending = await processLine(line);
      if (ending !== "ok") break;
    }

    session.clearScript();
    session.resetToRoot();
    say(
      ending === "ok"
        ? "Script execution completed successfully"
        : "Script execution stopped",
    );
    appendMenu();
    drawPrompt();
  };

  const handleSubmit = async (raw: string) => {
    input.clear();
    // A command is about to print: follow it.
    following = true;

    const ending = await processLine(raw);
    if (ending === "exit") return;

    // `script <file>` only records what to run; drive it from here.
    const script = session.state.scriptContext;
    if (script?.filename && script.currentCommand && !script.exitAfterCompletion) {
      await runScript();
    }
  };

  // The log view can only scroll to the bottom once it knows how tall it is,
  // and that is a product of layout. Run one pass up front so the opening
  // screen shows the whole menu instead of only its last line; the app's own
  // first pass then finds nothing new to compute.
  const layoutRoot = root.getLayoutNode();
  computeLayout(layoutRoot, app.terminal.cols, app.terminal.rows);
  root.syncLayout();

  for (const line of WELCOME) say(line);
  appendMenu();

  // The input is the only focusable widget; registering it makes it the focus
  // target, so keystrokes reach it without a Tab press.
  app.focus.register(input);

  // Ctrl-C and Ctrl-X arrive as key bytes (raw mode means no SIGINT), and the
  // input widget lets ctrl combos it does not handle bubble up. These are the
  // kill switch: the shell owns the terminal, so exiting here is what restores
  // it (termui also restores on SIGINT/SIGTERM).
  app.events.on("key", (event) => {
    if (event.ctrl && (event.key === "c" || event.key === "x")) {
      app.exit(0);
      return;
    }

    // Scrolling: only keys the input widget leaves alone reach here.
    const intent = logScrollIntent(
      event.key,
      Boolean(event.ctrl),
      Math.max(1, log.rect.height - 1),
    );
    if (!intent) return;
    scrollLog(intent);
    event.stopPropagation();
  });

  // Wheel scrolling. Enabling the mouse means the terminal hands drag-select to
  // the app; hold Shift while dragging to select text as usual.
  app.events.on("mouse", (event) => {
    const intent = logScrollFromMouse(event);
    if (intent) scrollLog(intent);
  });

  return await app.mount();
};
