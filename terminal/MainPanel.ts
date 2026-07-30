/**
 * @file MainPanel — Bloomberg-style full-screen TUI abstraction.
 *
 * Layout:
 * ┌─────────────────────────────────────────────┐
 * │  DATA AREA (main content, scrollable)        │
 * │                                              │
 * │  Shows the last command's output             │
 * │                                              │
 * ├─────────────────────────────────────────────┤
 * │  > command input line                        │
 * ├─────────────────────────────────────────────┤
 * │  [1] Stocks  [2] Crypto  [3] News  ...      │  ← menu bar (2 rows)
 * │  [4] Predict  [5] Options  [6] Exit         │
 * └─────────────────────────────────────────────┘
 */

import terminalKit from "terminal-kit";
import chalk from "chalk";

const term = terminalKit.terminal;

export interface PanelOption {
  key: string;       // "1", "2", ... "9", "0"
  label: string;     // "Stocks"
  description: string; // "Fetch stock prices"
}

export interface PanelConfig {
  title: string;
  options: PanelOption[];
}

/**
 * Captures console output during an action execution.
 * Returns the captured text and restores the original console methods.
 */
export function captureConsole<T>(fn: () => T | Promise<T>): { result: Promise<T>; getOutput: () => string } {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: any[]) => {
    lines.push(args.map(a => (typeof a === "string" ? a : JSON.stringify(a, null, 2))).join(" "));
  };
  console.error = (...args: any[]) => {
    lines.push(chalk.red(args.map(a => (typeof a === "string" ? a : JSON.stringify(a, null, 2))).join(" ")));
  };
  console.warn = (...args: any[]) => {
    lines.push(chalk.yellow(args.map(a => (typeof a === "string" ? a : JSON.stringify(a, null, 2))).join(" ")));
  };

  const result = (async () => {
    try {
      return await fn();
    } finally {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  })();

  return {
    result,
    getOutput: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      return lines.join("\n");
    },
  };
}

/**
 * MainPanel manages the full-screen Bloomberg-style layout.
 *
 * It owns a terminal-kit ScreenBuffer and provides methods to:
 * - Render the data area with captured output
 * - Render the menu bar with keybinding options
 * - Render the command input line
 * - Handle keypress events
 */
export class MainPanel {
  private screen: any; // terminal-kit ScreenBuffer
  private width: number;
  private height: number;
  private dataLines: string[] = [];
  private options: PanelOption[] = [];
  private title: string;
  private commandText: string = "";
  private cursorPos: number = 0;
  private statusLine: string = "";
  private customRenderer: ((dataAreaHeight: number) => string[]) | null = null;

  constructor(config: PanelConfig) {
    this.title = config.title;
    this.options = config.options;
    this.width = term.width || 120;
    this.height = term.height || 40;
  }

  /**
   * Initialize the full-screen mode.
   * Must be called before any rendering.
   */
  init(): void {
    term.fullscreen(true);
    term.grabInput(true);
    term.hideCursor();
    this.width = term.width;
    this.height = term.height;
  }

  /**
   * Clean up and restore the terminal.
   */
  destroy(): void {
    term.grabInput(false);
    term.fullscreen(false);
    term.hideCursor(false);
    term.processExit(0);
  }

  /**
   * Set the data content to display in the main area.
   */
  setData(lines: string[]): void {
    this.dataLines = lines;
  }

  /**
   * Set the status line (shown above the command input).
   */
  setStatus(text: string): void {
    this.statusLine = text;
  }

  /**
   * Set the menu options.
   */
  setOptions(options: PanelOption[]): void {
    this.options = options;
  }

  /**
   * Set the command input text.
   */
  setCommandText(text: string): void {
    this.commandText = text;
    this.cursorPos = text.length;
  }

  /**
   * Set a custom renderer for the data area.
   * When set, the data area will be rendered by this function instead of dataLines.
   * Pass null to restore default behavior.
   */
  setCustomRenderer(renderer: ((dataAreaHeight: number) => string[]) | null): void {
    this.customRenderer = renderer;
  }

  /**
   * Render the full screen layout.
   */
  render(): void {
    term.reset();
    this.width = term.width;
    this.height = term.height;

    const menuRows = Math.ceil(this.options.length / 5); // 5 options per row
    const menuHeight = menuRows + 1; // +1 for the separator line
    const commandHeight = 2; // command input + separator
    const statusHeight = this.statusLine ? 1 : 0;
    const dataHeight = this.height - menuHeight - commandHeight - statusHeight - 1; // -1 for top border

    // ── Title bar ──
    term(chalk.bgBlackBright(chalk.white(` ${this.title} `)) + "\n");

    // ── Data area ──
    if (this.customRenderer) {
      const customLines = this.customRenderer(dataHeight);
      for (const line of customLines) {
        const display = line.length > this.width ? line.slice(0, this.width - 3) + "..." : line;
        term(display + "\n");
      }
    } else {
      const visibleData = this.dataLines.slice(-Math.max(dataHeight, 1));
      // Pad with empty lines if needed
      while (visibleData.length < dataHeight) {
        visibleData.unshift("");
      }

      for (const line of visibleData) {
        // Truncate to width
        const display = line.length > this.width ? line.slice(0, this.width - 3) + "..." : line;
        term(display + "\n");
      }
    }

    // ── Status line ──
    if (this.statusLine) {
      term(chalk.dim(this.statusLine) + "\n");
    }

    // ── Command input separator ──
    term(chalk.dim("─".repeat(this.width)) + "\n");

    // ── Command input ──
    term("> " + this.commandText);
    // Fill rest of line
    const remaining = this.width - 2 - this.commandText.length;
    if (remaining > 0) term(" ".repeat(remaining));
    term("\n");

    // ── Menu separator ──
    term(chalk.dim("─".repeat(this.width)) + "\n");

    // ── Menu bar ──
    const perRow = 5;
    for (let row = 0; row < menuRows; row++) {
      const rowOptions = this.options.slice(row * perRow, (row + 1) * perRow);
      let line = "";
      for (const opt of rowOptions) {
        const entry = `[${opt.key}] ${opt.label}`;
        line += entry.padEnd(Math.floor(this.width / perRow));
      }
      term(chalk.bgBlue(chalk.white(line.slice(0, this.width))) + "\n");
    }
  }

  /**
   * Wait for user input — either a keypress (for menu selection) or typed command.
   * Returns the action to take.
   */
  async getInput(): Promise<{ type: "key"; key: string } | { type: "command"; text: string }> {
    return new Promise((resolve) => {
      const onKey = (name: string, _matches: any, _data: any) => {
        // Check if it's a menu keybinding
        const option = this.options.find(o => o.key === name);
        if (option) {
          term.off("key", onKey);
          resolve({ type: "key", key: name });
          return;
        }

        // Handle special keys
        if (name === "CTRL_C" || name === "ESCAPE") {
          term.off("key", onKey);
          this.destroy();
          return;
        }

        if (name === "BACKSPACE" || name === "DELETE") {
          if (this.commandText.length > 0) {
            this.commandText = this.commandText.slice(0, -1);
            this.cursorPos = Math.max(0, this.cursorPos - 1);
            this.render();
          }
          return;
        }

        if (name === "ENTER") {
          term.off("key", onKey);
          const text = this.commandText.trim();
          this.commandText = "";
          this.cursorPos = 0;
          if (text) {
            resolve({ type: "command", text });
          } else {
            // Empty enter — re-render and wait again
            this.render();
            term.on("key", onKey);
          }
          return;
        }

        // Regular character input
        if (name.length === 1) {
          this.commandText += name;
          this.cursorPos++;
          this.render();
        }
      };

      term.on("key", onKey);
    });
  }
}
