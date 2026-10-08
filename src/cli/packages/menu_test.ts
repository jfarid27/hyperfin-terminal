import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Effect } from "effect";
import { packageMenuOption, packageMenuOptions } from "./menu.ts";
import type { DiscoveredPackage, LoadedPackage } from "./types.ts";
import type { Menu } from "../types.ts";

const ROOT = "/repo/hyperfin-packages";

const discovered: DiscoveredPackage = {
    dirName: "my-menu",
    dirPath: `${ROOT}/my-menu`,
    manifestPath: `${ROOT}/my-menu/hyperfin-package.json`,
    entryPath: `${ROOT}/my-menu/index.ts`,
    name: "My Menu",
    description: "does things",
    command: "mymenu",
};

const rawMenu: Menu = {
    name: "My Menu",
    description: "does things",
    messagePrompt: "Select an option:",
    options: () => [],
};

const loadedRaw: LoadedPackage = { pkg: discovered, entry: rawMenu };

const menuFn = (_st: unknown) => Effect.void as never;
const loadedFn: LoadedPackage = { pkg: { ...discovered, command: "fnmenu" }, entry: menuFn };

describe("packageMenuOption", () => {
    it("exposes the package as a top-level command", () => {
        const option = packageMenuOption(loadedRaw, ROOT);
        expect(option.name).toBe("My Menu");
        expect(option.command).toBe("mymenu");
        // The description carries the provenance so the user can find the
        // package that contributed the menu.
        expect(option.description).toContain("does things");
        expect(option.description).toContain("my-menu/index.ts");
        expect(typeof option.action).toBe("function");
    });
});

describe("packageMenuOptions", () => {
    it("maps every loaded package onto an option", () => {
        const options = packageMenuOptions([loadedRaw, loadedFn], ROOT);
        expect(options.map((o) => o.command)).toEqual(["mymenu", "fnmenu"]);
    });

    it("returns nothing when no packages are installed", () => {
        expect(packageMenuOptions([], ROOT)).toEqual([]);
    });
});
