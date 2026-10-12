/**
 * Shared test utilities for E2E tests
 */

/**
 * Helper function to run the CLI with a test script
 * Uses a shell to pipe the script command properly
 * @param scriptName - Name of the script file in scripts/ directory
 * @returns Promise with output string and exit code
 */
export async function runScript(scriptName: string): Promise<{ output: string; code: number }> {
  const isWindows = Deno.build.os === "windows";

  const command = new Deno.Command(isWindows ? "cmd" : "sh", {
    args: isWindows
      ? ["/c", `echo script ${scriptName} | deno run --allow-all index.ts`]
      : ["-c", `echo "script ${scriptName}" | deno run --allow-all index.ts`],
    stdout: "piped",
    stderr: "piped",
    cwd: Deno.cwd(),
    env: {
      ...Deno.env.toObject(),
      MOCK_API: "true",
      NO_COLOR: "1",
      FORCE_COLOR: "0"
    },
  });

  const { code, stdout, stderr } = await command.output();
  const output = new TextDecoder().decode(stdout);
  const errorOutput = new TextDecoder().decode(stderr);

  return {
    output: output + errorOutput,
    code
  };
}

/**
 * Helper to run with timeout
 */
export async function runScriptWithTimeout(
  scriptName: string,
  timeoutMs: number = 30000
): Promise<{ output: string; code: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await runScript(scriptName);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Helper to drive the CLI with raw input lines instead of a single piped
 * command. The menu loop reads one line per stdin read, so each line is written
 * and allowed to be consumed (with a pause) before the next one goes in —
 * that is what makes it possible to assert on where the terminal is *after* a
 * command, rather than only on the command itself.
 */
export async function runWithInput(
  lines: string[],
  {
    args = ["run", "--allow-all", "index.ts"],
    pauseMs = 1000,
    timeoutMs = 30000,
  }: { args?: string[]; pauseMs?: number; timeoutMs?: number } = {},
): Promise<{ output: string; code: number }> {
  const command = new Deno.Command(Deno.execPath(), {
    args,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
    cwd: Deno.cwd(),
    env: {
      ...Deno.env.toObject(),
      MOCK_API: "true",
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
  });

  const child = command.spawn();
  const writer = child.stdin.getWriter();
  const encoder = new TextEncoder();
  const timeoutId = setTimeout(() => child.kill("SIGKILL"), timeoutMs);

  try {
    for (const line of lines) {
      await writer.write(encoder.encode(`${line}\n`));
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    await writer.close();

    const { code, stdout, stderr } = await child.output();
    return {
      output: new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr),
      code,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
