#!/usr/bin/env node
import { startMain } from "src/cli/index.ts";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const oetScriptIndex = args.indexOf("--oet-script");
const scriptFilename = oetScriptIndex !== -1 && args[oetScriptIndex + 1]
  ? args[oetScriptIndex + 1]
  : undefined;

const sessionPath = join("sessions", `${crypto.randomUUID()}.jsonl`);
await mkdir("sessions", { recursive: true });
await writeFile(sessionPath, "");

await startMain(sessionPath, scriptFilename);
