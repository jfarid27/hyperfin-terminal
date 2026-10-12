/**
 * Navigation Tests - Menu navigation flows
 */

import { assert } from "jsr:@std/assert";
import { runScriptWithTimeout, runWithInput } from "./helpers/runner.ts";

/**
 * The runner drives the CLI with a script file under `scripts/`, but that
 * directory is gitignored (only `.gitkeep`/`README.md` are tracked), so the
 * fixtures are not in the repository. Write ours on demand so this test is
 * self-contained and works on a fresh clone.
 *
 * Note the sibling navigation tests are vacuous without their fixtures: a
 * missing script exits 0 and prints the Main Menu, whose table happens to
 * contain the words they assert on. Ours asserts that the command actually
 * dispatched, so it needs the fixture to really exist.
 */
const seedScript = (name: string, lines: string[]) => {
  Deno.mkdirSync("scripts", { recursive: true });
  Deno.writeTextFileSync(`scripts/${name}`, lines.join("\n") + "\n");
};

Deno.test("NAV: Can navigate to Crypto menu and back", async () => {
  const { output, code } = await runScriptWithTimeout("test_nav_crypto.txt");

  const hasCryptoContent =
    output.toLowerCase().includes("crypto") ||
    output.toLowerCase().includes("price") ||
    output.toLowerCase().includes("coingecko");

  assert(hasCryptoContent, `Expected crypto content in output: ${output.substring(0, 1000)}`);
  assert(code === 0, `Expected clean exit, got code ${code}`);
});

Deno.test("NAV: Can navigate to Stocks menu and back", async () => {
  const { output, code } = await runScriptWithTimeout("test_nav_stocks.txt");

  const hasStocksContent =
    output.toLowerCase().includes("stock") ||
    output.toLowerCase().includes("alphavantage") ||
    output.toLowerCase().includes("quote");

  assert(hasStocksContent, `Expected stocks content in output: ${output.substring(0, 1000)}`);
  assert(code === 0, `Expected clean exit, got code ${code}`);
});

Deno.test("NAV: Can navigate to Predictions menu and back", async () => {
  const { output, code } = await runScriptWithTimeout("test_nav_predictions.txt");

  const hasPredictionsContent =
    output.toLowerCase().includes("prediction") ||
    output.toLowerCase().includes("polymarket") ||
    output.toLowerCase().includes("market");

  assert(hasPredictionsContent, `Expected predictions content in output: ${output.substring(0, 1000)}`);
  assert(code === 0, `Expected clean exit, got code ${code}`);
});

Deno.test("NAV: Can navigate to News menu and back", async () => {
  const { output, code } = await runScriptWithTimeout("test_nav_news.txt");

  const hasNewsContent =
    output.toLowerCase().includes("news") ||
    output.toLowerCase().includes("feed") ||
    output.toLowerCase().includes("rss");

  assert(hasNewsContent, `Expected news content in output: ${output.substring(0, 1000)}`);
  assert(code === 0, `Expected clean exit, got code ${code}`);
});

Deno.test("NAV: Can navigate to Forex menu and back", async () => {
  const { output, code } = await runScriptWithTimeout("test_nav_forex.txt");

  const hasForexContent =
    output.toLowerCase().includes("forex") ||
    output.toLowerCase().includes("exchange rate") ||
    output.toLowerCase().includes("eur");

  assert(hasForexContent, `Expected forex content in output: ${output.substring(0, 1000)}`);
  assert(code === 0, `Expected clean exit, got code ${code}`);
});

Deno.test("NAV: Can navigate into the Crypto technicals submenu and back", async () => {
  // Self-seed the fixture: `scripts/` is gitignored, so it is not in the repo.
  seedScript("test_nav_technicals.txt", ["crypto", "technicals", "back", "exit"]);

  const { output, code } = await runScriptWithTimeout("test_nav_technicals.txt");

  // Submenu tables are suppressed in script mode, so the observable signal is
  // that the `technicals` command dispatched rather than falling through to
  // "Invalid command" (which is what an unregistered command prints).
  assert(
    output.includes("Executing script command: technicals"),
    `Expected the technicals command to run: ${output.substring(0, 1000)}`,
  );
  assert(
    !output.includes("Invalid command"),
    `Expected technicals to be a registered menu option: ${output.substring(0, 1000)}`,
  );
  assert(code === 0, `Expected clean exit, got code ${code}`);
});

/**
 * A script started from the `script` command is interactive, so the terminal
 * has to be somewhere usable when it finishes. Its last command may have run
 * inside a submenu, which is not that place — the follow-up `keys` command is
 * only registered on the Main Menu, so it proves which menu took the input.
 */
Deno.test("NAV: A finished script returns to the Main Menu", async () => {
  seedScript("test_script_returns_home.txt", ["stocks"]);

  const { output, code } = await runWithInput([
    "script test_script_returns_home.txt",
    "keys",
    "exit",
  ]);

  assert(
    output.includes("Available API keys"),
    `Expected the Main Menu to read the next command: ${output.substring(0, 2000)}`,
  );
  assert(
    !output.includes("unknown command 'keys'"),
    `Expected the terminal to leave the Stocks menu: ${output.substring(0, 2000)}`,
  );
  assert(code === 0, `Expected clean exit, got code ${code}`);
});

Deno.test("NAV: A script that aborts returns to the Main Menu", async () => {
  seedScript("test_script_aborts_home.txt", ["stocks", "not-a-command"]);

  const { output, code } = await runWithInput([
    "script test_script_aborts_home.txt",
    "keys",
    "exit",
  ]);

  assert(
    output.includes("Script execution aborted due to error."),
    `Expected the script to report its failure: ${output.substring(0, 2000)}`,
  );
  assert(
    output.includes("Available API keys"),
    `Expected the Main Menu to read the next command: ${output.substring(0, 2000)}`,
  );
  assert(
    !output.includes("unknown command 'keys'"),
    `Expected the terminal to leave the Stocks menu: ${output.substring(0, 2000)}`,
  );
  assert(code === 0, `Expected clean exit, got code ${code}`);
});

/**
 * `--oet-script` is a batch entrypoint, not an interactive one: it still runs
 * the script and exits instead of dropping into a menu.
 */
Deno.test("NAV: --oet-script exits when the script completes", async () => {
  seedScript("test_script_batch.txt", ["stocks"]);

  const { output, code } = await runWithInput([], {
    args: ["run", "--allow-all", "index.ts", "--oet-script", "test_script_batch.txt"],
  });

  assert(
    output.includes("Script execution completed successfully"),
    `Expected the batch run to complete: ${output.substring(0, 2000)}`,
  );
  assert(
    !output.includes("Stocks Menu"),
    `Expected no menu in a batch run: ${output.substring(0, 2000)}`,
  );
  assert(code === 0, `Expected clean exit, got code ${code}`);
});
