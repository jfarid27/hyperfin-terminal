# Hyperfin Packages

Drop-in menus for the Hyperfin terminal.

Any directory inside this folder that declares a package manifest is
scanned at startup and registered as a **top level menu option** — the
same way the built-in `stocks`, `crypto` or `options` menus are.

This folder is a plain directory, not a git submodule directory. It does
**not** collide with `.gitmodules`: a submodule committed to this
repository lives elsewhere (see `.gitmodules`), while anything you drop
here is picked up by *your* install only and stays out of version
control. That is deliberate — an extension you install locally must not
become part of the project's own module list.

## Quick start

```bash
mkdir -p hyperfin-packages/my-menu
cd hyperfin-packages/my-menu
```

Create `hyperfin-package.json`:

```json
{
  "name": "my-menu",
  "description": "What my menu does",
  "command": "mymenu",
  "entry": "index.ts"
}
```

Create `index.ts`, exporting a `Menu`:

```typescript
import { Effect } from "effect";
import { registerTerminalApplication } from "../../src/cli/utils/program_loader.ts";
import {
    CommandResultType,
    type Menu,
    type MenuOption,
    TerminalUserStateConfigContext,
} from "../../src/cli/types.ts";
import { menuGlobals } from "../../src/cli/utils/menu_globals.ts";

const options = (state) => [
    {
        name: "hello",
        command: "hello [name]",
        description: "Say hello",
        action: (name?: string) => Effect.gen(function* () {
            const st = yield* TerminalUserStateConfigContext;
            console.log(`Hello, ${name ?? "world"}!`);
            return { result: { type: CommandResultType.Success }, state: st };
        }),
    },
    ...menuGlobals(state),
];

const myMenu: Menu = {
    name: "My Menu",
    description: "My custom menu",
    messagePrompt: "Select an option:",
    options,
};

export const menu = registerTerminalApplication(myMenu);
export default menu;
```

Restart the terminal: `mymenu` now appears in the Main Menu.

The `example-package/` directory next to this file is a complete, working
package — copy it as a starting point.

## Installing a package from git

A package is an ordinary directory, so any git checkout works. Clone it
straight into this folder:

```bash
# a standalone repository
git clone https://github.com/you/hyperfin-my-menu.git hyperfin-packages/my-menu

# a subdirectory of a larger repository (sparse checkout)
git clone --filter=blob:none --sparse https://github.com/you/hyperfin-extensions.git /tmp/hf-ext
cd /tmp/hf-ext
git sparse-checkout set packages/my-menu
mv packages/my-menu /path/to/hyperfin-terminal/hyperfin-packages/
```

Because the folder is not tracked, a plain `git clone` into it will *not*
register a submodule in the Hyperfin repository — `git status` stays clean
and the project's own `.gitmodules` is untouched.

## Manifest reference

| Field | Required | Description |
|---|---|---|
| `entry` | yes | Module to import, **relative to the package directory**. Must end in `.ts`, `.js` or `.mjs`. Absolute paths and `..` traversal are rejected. |
| `name` | no | Display name in the menu. Defaults to the directory name. |
| `description` | no | Menu description. Defaults to `<name> (hyperfin package)`. |
| `command` | no | Command token to type. Defaults to the slugified `name`. Must be a single word (`hello`, `my-menu`). |

`hyperfin-package.json` is preferred, but an existing `package.json` that
declares an `entry` field is also accepted — useful when a package is
itself a Node/Deno project.

## What a package can do

A package is a `Menu`, so it can do anything a built-in menu can:

* define its own submenus and actions;
* print custom tables (`src/cli/utils/table_markup.ts` helps with styling);
* use the loaded state and API keys (`st.loadedContext`, `st.apiKeys`);
* render charts with the shared `ChartRenderer`
  (`src/cli/StocksMenu/services/ChartRenderer.ts`);
* add global options such as `back` / `exit` via `menuGlobals(state)`.

Follow the conventions in `src/cli/README.md` and the project skill
documents so your menu behaves like the rest.

## What is *not* allowed

* **Command collisions.** A package may not claim a built-in command
  (`crypto`, `stocks`, `news`, `options`, `bonds`, `forex`,
  `predictions`, `government`, `script`, `keys`, `exit`, `showconfig`).
  Rename it with the `command` field; the collision is reported at
  startup and the package is skipped.
* **Entries outside the package directory.** `entry` is resolved inside
  the package folder only.

## Startup output

When the terminal starts, loaded packages are listed:

```
Loaded 1 hyperfin package: hello
```

Anything found but skipped is reported with the reason, for example:

```
hyperfin-packages: skipped 1 entry in /path/to/hyperfin-packages
  - my-menu: no hyperfin-package.json or package.json found (see hyperfin-packages/README.md)
```

A broken package never blocks startup: it is skipped with a message and
the terminal continues.

## How it works

1. `src/cli/packages/discovery.ts` scans this folder at startup for direct
   subdirectories with a valid manifest (symlinked directories are
   followed, dotted names ignored) and drops commands that collide with
   built-ins.
2. `src/cli/packages/menu.ts` turns each discovered package into a
   top-level `MenuOption`; the option's action imports the entry module
   and runs the exported `Menu` — the same recursion the built-ins use.
3. `startMain` in `src/cli/index.ts` calls the two steps above before the
   menu loop begins.
