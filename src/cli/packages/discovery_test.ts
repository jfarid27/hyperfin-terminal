import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { discoverPackages, packagesDirFor } from "./discovery.ts";

// `deno test` runs from the repository root (the e2e suite relies on the
// same assumption for `scripts/`), so a cwd-relative fixture path avoids
// pulling in a new dependency just for this test.
const FIXTURES = `${Deno.cwd()}/test/fixtures/packages`;

describe("packagesDirFor", () => {
    it("joins the packages folder onto a working directory", () => {
        expect(packagesDirFor("/repo")).toBe("/repo/hyperfin-packages");
    });
});

describe("discoverPackages", () => {
    const result = discoverPackages(FIXTURES, ["crypto", "stocks"]);
    const byDir = (name: string) => result.skipped.find((s) => s.dirName === name);

    it("registers directories with a valid manifest", () => {
        const commands = result.packages.map((p) => p.command).sort();
        expect(commands).toEqual(["default-function-package", "good"]);
    });

    it("prefers hyperfin-package.json and falls back to package.json", () => {
        const good = result.packages.find((p) => p.dirName === "good");
        expect(good?.manifestPath.endsWith("hyperfin-package.json")).toBe(true);

        const fallback = result.packages.find((p) => p.dirName === "default-fn");
        expect(fallback?.manifestPath.endsWith("package.json")).toBe(true);
    });

    it("reports a directory with no manifest instead of guessing", () => {
        expect(byDir("no-manifest")?.reason).toContain("no hyperfin-package.json");
    });

    it("skips unparseable manifests with the read error", () => {
        expect(byDir("bad-json")?.reason).toContain("could not read");
    });

    it("skips entries that escape the package directory", () => {
        expect(byDir("escape")?.reason).toContain("escapes");
    });

    it("skips packages whose command collides with a built-in", () => {
        expect(byDir("collision")?.reason).toContain("already registered");
        expect(result.packages.some((p) => p.command === "crypto")).toBe(false);
    });

    it("ignores dotted directories and plain files", () => {
        expect(result.skipped.some((s) => s.dirName === ".hidden")).toBe(false);
        expect(result.packages.some((p) => p.dirName === "README.md")).toBe(false);
    });

    it("returns an empty result for a missing folder rather than throwing", () => {
        const missing = discoverPackages(`${FIXTURES}/does-not-exist`);
        expect(missing.packages).toEqual([]);
        expect(missing.skipped).toEqual([]);
    });

    it("reserves the command token, not the package display name", () => {
        // The `good` fixture has name "good-package" and command "good".
        const byName = discoverPackages(FIXTURES, ["good-package"]);
        expect(byName.packages.some((p) => p.dirName === "good")).toBe(true);

        const byCommand = discoverPackages(FIXTURES, ["good"]);
        expect(byCommand.packages.some((p) => p.dirName === "good")).toBe(false);
    });
});
