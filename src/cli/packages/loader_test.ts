import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { discoverPackages } from "./discovery.ts";
import {
    importPackageEntry,
    isMenu,
    isPackageEntry,
    loadPackages,
    relativeEntryPath,
} from "./loader.ts";
import { asMenuRunner } from "./menu.ts";
import { registerTerminalApplication } from "../utils/program_loader.ts";
import type { DiscoveredPackage, PackageEntry } from "./types.ts";
import type { Menu, TerminalUserStateConfig } from "../types.ts";

// `deno test` runs from the repository root; see discovery_test.ts.
const FIXTURES = `${Deno.cwd()}/test/fixtures/packages`;

/** The raw `Menu` the `good` fixture exports. */
const goodMenu: Menu = {
    name: "Good Package",
    description: "A valid fixture package",
    messagePrompt: "Select an option:",
    options: () => [],
};

describe("isMenu", () => {
    it("accepts a Menu object", () => {
        expect(isMenu(goodMenu)).toBe(true);
    });

    it("rejects functions, null and partial objects", () => {
        expect(isMenu(() => {})).toBe(false);
        expect(isMenu(null)).toBe(false);
        expect(isMenu({ name: "x" })).toBe(false);
    });
});

describe("isPackageEntry", () => {
    it("accepts both a menu function and a Menu object", () => {
        expect(isPackageEntry((st: TerminalUserStateConfig) => Effect.succeed(st))).toBe(true);
        expect(isPackageEntry(goodMenu)).toBe(true);
    });

    it("rejects scalars", () => {
        expect(isPackageEntry("nope")).toBe(false);
        expect(isPackageEntry(123)).toBe(false);
    });
});

describe("importPackageEntry", () => {
    it("prefers the named `menu` export over the default export", async () => {
        const entry = await importPackageEntry(`${FIXTURES}/good/index.ts`);
        expect(isMenu(entry)).toBe(true);
        expect((entry as Menu).name).toBe("Good Package");
    });

    it("falls back to the default export", async () => {
        const entry = await importPackageEntry(`${FIXTURES}/default-fn/entry.ts`);
        expect(typeof entry).toBe("function");
    });
});

describe("loadPackages", () => {
    it("loads every discovered package and skips nothing", async () => {
        const discovery = discoverPackages(FIXTURES, ["crypto", "stocks"]);
        const { packages, skipped } = await loadPackages(discovery.packages);

        expect(skipped).toEqual([]);
        expect(packages.map((p) => p.pkg.dirName).sort()).toEqual([
            "default-fn",
            "good",
        ]);
    });

    it("isolates a package whose entry cannot be imported", async () => {
        const broken: DiscoveredPackage = {
            dirName: "broken",
            dirPath: "/nonexistent/broken",
            manifestPath: "/nonexistent/broken/hyperfin-package.json",
            entryPath: "/nonexistent/broken/index.ts",
            name: "broken",
            description: "",
            command: "broken",
        };

        const { packages, skipped } = await loadPackages([broken]);
        expect(packages).toEqual([]);
        expect(skipped).toHaveLength(1);
        expect(skipped[0].reason).toContain("failed to import entry");
    });
});

describe("asMenuRunner", () => {
    it("passes a menu function straight through", () => {
        const fn = (_st: unknown) => Effect.void as never;
        const runner = asMenuRunner(
            fn as PackageEntry,
            registerTerminalApplication,
        );
        expect(runner).toBe(fn);
    });

    it("wraps a raw Menu into a runnable application", () => {
        const runner = asMenuRunner(goodMenu, registerTerminalApplication);
        expect(typeof runner).toBe("function");
    });
});

describe("relativeEntryPath", () => {
    const pkg = (entryPath: string): DiscoveredPackage => ({
        dirName: "good",
        dirPath: `${FIXTURES}/good`,
        manifestPath: `${FIXTURES}/good/hyperfin-package.json`,
        entryPath,
        name: "good",
        description: "",
        command: "good",
    });

    it("strips the packages root prefix", () => {
        expect(relativeEntryPath(pkg(`${FIXTURES}/good/index.ts`), FIXTURES))
            .toBe("good/index.ts");
    });

    it("falls back to the absolute path when outside the root", () => {
        const outside = "/elsewhere/index.ts";
        expect(relativeEntryPath(pkg(outside), FIXTURES)).toBe(outside);
    });
});
