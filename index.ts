#!/usr/bin/env node
import { startMain } from "cli/index.ts";

// Parse command-line arguments for --oet-script flag
const args = process.argv.slice(2);
const oetScriptIndex = args.indexOf('--oet-script');
const scriptFilename = oetScriptIndex !== -1 && args[oetScriptIndex + 1]
  ? args[oetScriptIndex + 1]
  : undefined;

startMain(scriptFilename);
