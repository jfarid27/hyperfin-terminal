/**
 * Navigation Tests - Menu navigation flows
 */

import { assert } from "jsr:@std/assert";
import { runScriptWithTimeout } from "./helpers/runner.ts";

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
