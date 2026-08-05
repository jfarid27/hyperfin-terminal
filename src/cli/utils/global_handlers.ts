import terminalKit from "terminal-kit";
const { terminal } = terminalKit;

let _globalHandlersInstalled = false;

/**
  * Global Ctrl-X kill switch — set up once so the user can always bail out,
  * even when the app hangs inside a nested menu or a long-running action.
  */
export function installGlobalHandlers(): void {
  if (_globalHandlersInstalled) return;

  // Only install in interactive TTY mode. In piped/script mode (e2e tests,
  // cron, etc.) these handlers are actively harmful: the SIGINT handler
  // replaces the default hard-kill with a cooperative Deno.exit(0) that
  // waits for the event loop to drain, which never happens while terminal-kit
  // has active listeners. The process hangs and the test runner times out.
  if (!Deno.stdin.isTerminal()) return;

  _globalHandlersInstalled = true;

  // Ctrl-X anywhere → clean exit
  terminal.on("key", (name: string) => {
    if (name === "CTRL_X") {
      terminal.styleReset();
      terminal.restoreCursor();
      terminal.processExit(0);
    }
  });

  // OS signals — restore the terminal so the user's shell isn't left in raw
  // mode when the process is killed externally.
  const cleanup = () => {
    terminal.styleReset();
    terminal.restoreCursor();
    Deno.exit(0);
  };

  try {
    Deno.addSignalListener("SIGTERM", cleanup);
    Deno.addSignalListener("SIGINT", cleanup);
  } catch {
    // Deno.addSignalListener may not be available in all runtimes; ignore.
  }
}
