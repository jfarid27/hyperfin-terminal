import { Effect } from "effect";
import chalk from "chalk";
import { readFile } from "node:fs/promises";
import {
    CommandResultType, TerminalUserStateConfigContext
} from "cli/types.ts";
import { join } from "node:path";
import { LocalProcessingError } from "cli/errors/index.ts";

export const executeScript = (filename: string) => Effect.gen(function*() {
  const st = yield* TerminalUserStateConfigContext;
  const scriptPath = join(process.cwd(), "scripts", filename);
  const fileContent = yield* Effect.tryPromise({
      try: () => readFile(scriptPath, "utf-8"),
      catch: () => new LocalProcessingError({ message: `Failed to load script: `})
  });

  const [currentCommand, ...tailCommands] = fileContent.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  return {
      result: { type: CommandResultType.Success },
      state: {
          ...st,
          scriptContext: {
              filename,
              currentCommand,
              tailCommands,
          }
      },
  };
})
