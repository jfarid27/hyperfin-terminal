/**
 * Package Tests - hyperfin-packages custom menu entrypoints
 *
 * The bundled `hyperfin-packages/example-package/` ships with the
 * repository, so this test needs no fixture and works on a fresh clone.
 *
 * Assertions target dispatch-specific output rather than menu words: the
 * Main Menu table contains "crypto", "stocks" and friends, so asserting on
 * those would pass vacuously even if the package were never registered.
 */

import { assert } from "jsr:@std/assert";
import { runScript } from "./helpers/runner.ts";

const seedScript = (name: string, lines: string[]) => {
    Deno.mkdirSync("scripts", { recursive: true });
    Deno.writeTextFileSync(`scripts/${name}`, lines.join("\n") + "\n");
};

Deno.test("PACKAGES: bundled example package is registered in the main menu", async () => {
    seedScript("test_pkg_menu.txt", ["exit"]);

    const { output, code } = await runScript("test_pkg_menu.txt");

    assert(
        output.includes("Loaded 1 hyperfin package: hello"),
        `Expected the example package to be reported as loaded: ${output.substring(0, 1500)}`,
    );
    assert(
        output.includes("hello-quotes") && output.includes("example-package/index.ts"),
        `Expected the package row in the main menu: ${output.substring(0, 2000)}`,
    );
    assert(code === 0, `Expected clean exit, got code ${code}`);
});

Deno.test("PACKAGES: a package menu runs its own actions", async () => {
    seedScript("test_pkg_action.txt", ["hello", "greet e2e", "back", "exit"]);

    const { output, code } = await runScript("test_pkg_action.txt");

    assert(
        output.includes("Executing script command: hello"),
        `Expected the package command to dispatch: ${output.substring(0, 1500)}`,
    );
    assert(
        !output.includes("Invalid command"),
        `Package command should be registered, got: ${output.substring(0, 1500)}`,
    );
    assert(
        output.includes("Hello, e2e — from a hyperfin package!"),
        `Expected the package action to run: ${output.substring(0, 3000)}`,
    );
    assert(code === 0, `Expected clean exit, got code ${code}`);
});
