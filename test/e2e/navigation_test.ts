/**
 * Navigation Tests - Menu navigation flows
 */

import { assert } from "jsr:@std/assert";
import { runScriptWithTimeout } from "./helpers/runner.ts";

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
