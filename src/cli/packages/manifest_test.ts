import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
    applyReservedCommands,
    parsePackageManifest,
    resolvePackageEntry,
    slugifyPackageCommand,
} from "./manifest.ts";
import type { DiscoveredPackage } from "./types.ts";

// ── slugifyPackageCommand ──

describe("slugifyPackageCommand", () => {
    it("lowercases and dashes runs of non-alphanumerics", () => {
        expect(slugifyPackageCommand("Hello World")).toBe("hello-world");
        expect(slugifyPackageCommand("My__Menu")).toBe("my-menu");
        expect(slugifyPackageCommand("  padded  ")).toBe("padded");
    });

    it("trims leading and trailing separators", () => {
        expect(slugifyPackageCommand("--weird--")).toBe("weird");
    });
});

// ── resolvePackageEntry ──

describe("resolvePackageEntry", () => {
    it("resolves a relative entry against the package directory", () => {
        const resolved = resolvePackageEntry("/pkgs/mine", "index.ts");
        expect(resolved.ok).toBe(true);
        if (resolved.ok) expect(resolved.path).toBe("/pkgs/mine/index.ts");
    });

    it("rejects absolute entry paths", () => {
        const resolved = resolvePackageEntry("/pkgs/mine", "/etc/passwd.ts");
        expect(resolved.ok).toBe(false);
    });

    it("rejects traversal outside the package directory", () => {
        const resolved = resolvePackageEntry("/pkgs/mine", "../outside.ts");
        expect(resolved.ok).toBe(false);
        if (!resolved.ok) expect(resolved.reason).toContain("escapes");
    });

    it("rejects unrecognised extensions", () => {
        const resolved = resolvePackageEntry("/pkgs/mine", "data.json");
        expect(resolved.ok).toBe(false);
        if (!resolved.ok) expect(resolved.reason).toContain("must end in");
    });

    it("rejects an empty entry", () => {
        expect(resolvePackageEntry("/pkgs/mine", "   ").ok).toBe(false);
    });
});

// ── parsePackageManifest ──

describe("parsePackageManifest", () => {
    const parse = (raw: unknown) =>
        parsePackageManifest(raw, "mine", "/pkgs/mine", "/pkgs/mine/hyperfin-package.json");

    it("accepts a complete manifest", () => {
        const result = parse({
            name: "My Menu",
            description: "does things",
            command: "mymenu",
            entry: "index.ts",
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.pkg.name).toBe("My Menu");
            expect(result.pkg.command).toBe("mymenu");
            expect(result.pkg.entryPath).toBe("/pkgs/mine/index.ts");
        }
    });

    it("defaults name to the directory and command to its slug", () => {
        const result = parse({ entry: "main.ts" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.pkg.name).toBe("mine");
            expect(result.pkg.command).toBe("mine");
        }
    });

    it("rejects a manifest with no entry", () => {
        const result = parse({ name: "no entry" });
        expect(result.ok).toBe(false);
    });

    it("rejects a non-string entry", () => {
        expect(parse({ entry: 42 }).ok).toBe(false);
    });

    it("rejects a command that is not a single word", () => {
        const result = parse({ name: "two words", command: "two words", entry: "index.ts" });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toContain("single word");
    });
});

// ── applyReservedCommands ──

describe("applyReservedCommands", () => {
    const pkg = (command: string): DiscoveredPackage => ({
        dirName: command,
        dirPath: `/pkgs/${command}`,
        manifestPath: `/pkgs/${command}/hyperfin-package.json`,
        entryPath: `/pkgs/${command}/index.ts`,
        name: command,
        description: "",
        command,
    });

    it("drops packages that collide with a built-in command", () => {
        const { packages, skipped } = applyReservedCommands(
            [pkg("crypto"), pkg("mine")],
            ["crypto", "stocks"],
        );
        expect(packages.map((p) => p.command)).toEqual(["mine"]);
        expect(skipped).toHaveLength(1);
        expect(skipped[0].dirName).toBe("crypto");
        expect(skipped[0].reason).toContain("already registered");
    });

    it("keeps only the first of two packages with the same command", () => {
        const { packages, skipped } = applyReservedCommands(
            [pkg("dup"), pkg("dup")],
            [],
        );
        expect(packages).toHaveLength(1);
        expect(skipped).toHaveLength(1);
    });
});
