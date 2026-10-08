import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { packageNotes, reportPackages, resolvePackagesDir } from "./index.ts";
import type { PackageDiscoveryResult, PackageLoadResult } from "./types.ts";

const captureLog = () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
        lines.push(args.map(String).join(" "));
    };
    return {
        lines,
        restore: () => {
            console.log = original;
        },
    };
};

describe("resolvePackagesDir", () => {
    it("resolves against the working directory", () => {
        expect(resolvePackagesDir("/repo")).toBe("/repo/hyperfin-packages");
    });
});

describe("packageNotes", () => {
    it("is silent when nothing was skipped", () => {
        expect(packageNotes([], "/repo/hyperfin-packages")).toEqual([]);
    });

    it("singularises one skip and includes the reason", () => {
        const notes = packageNotes(
            [{ dirName: "bad", reason: "no manifest found" }],
            "/repo/hyperfin-packages",
        );
        expect(notes).toHaveLength(2);
        expect(notes[0]).toContain("skipped 1 entry");
        expect(notes[1]).toContain("bad: no manifest found");
    });

    it("pluralises multiple skips", () => {
        const notes = packageNotes(
            [
                { dirName: "a", reason: "x" },
                { dirName: "b", reason: "y" },
            ],
            "/repo/hyperfin-packages",
        );
        expect(notes[0]).toContain("skipped 2 entries");
    });
});

describe("reportPackages", () => {
    const discovery = (count: number): PackageDiscoveryResult => ({
        root: "/repo/hyperfin-packages",
        packages: Array.from({ length: count }, (_, i) => ({
            dirName: `p${i}`,
            dirPath: `/repo/hyperfin-packages/p${i}`,
            manifestPath: `/repo/hyperfin-packages/p${i}/hyperfin-package.json`,
            entryPath: `/repo/hyperfin-packages/p${i}/index.ts`,
            name: `p${i}`,
            description: "",
            command: `p${i}`,
        })),
        skipped: [],
    });

    const loaded = (count: number): PackageLoadResult => ({
        packages: Array.from({ length: count }, (_, i) => ({
            pkg: discovery(count).packages[i],
            entry: () => undefined as never,
        })),
        skipped: [],
    });

    it("stays silent when there is nothing to report", () => {
        const log = captureLog();
        try {
            reportPackages(discovery(0), loaded(0), []);
            expect(log.lines).toEqual([]);
        } finally {
            log.restore();
        }
    });

    it("lists the loaded package commands", () => {
        const log = captureLog();
        try {
            reportPackages(discovery(2), loaded(2), []);
            expect(log.lines).toHaveLength(1);
            expect(log.lines[0]).toContain("Loaded 2 hyperfin packages");
            expect(log.lines[0]).toContain("p0, p1");
        } finally {
            log.restore();
        }
    });

    it("prints skip notes even when nothing loaded", () => {
        const log = captureLog();
        try {
            reportPackages(discovery(1), loaded(0), ["note one"]);
            expect(log.lines).toEqual(["note one"]);
        } finally {
            log.restore();
        }
    });
});
