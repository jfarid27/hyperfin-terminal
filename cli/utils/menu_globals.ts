import { ActionOptions, CommandResultType, TerminalUserStateConfig, EnvironmentType, MenuOption, TerminalUserStateConfigContext } from "../types.ts";
import { Effect } from "effect";

const menu_back: MenuOption = {
    name: "back",
    command: "back",
    description: "Go back to the main menu",
    action: (_ops?: ActionOptions) => Effect.gen(function*() {
        const st = yield* TerminalUserStateConfigContext;
        return {
            result: { type: CommandResultType.Back },
            state: st,
        };
    }),
};

const menu_top: MenuOption = {
    name: "exit",
    command: "exit",
    description: "Exit the application",
    action: (_ops?: ActionOptions) => Effect.gen(function*() {
        const st = yield* TerminalUserStateConfigContext;
        return {
            result: { type: CommandResultType.Exit },
            state: st,
        };
    }),
};

const menu_showconfig: MenuOption = {
    name: "showconfig",
    command: "showconfig",
    description: "Show the current configuration",
    action: (_ops?: ActionOptions) => Effect.gen(function*() {
        const st = yield* TerminalUserStateConfigContext;
        console.log(st);
        return {
            result: { type: CommandResultType.Success },
            state: st,
        };
    }),
};

/**
 * Function to add the options for the submenus in the application,
 * with the back menu. Adds development options if the environment
 * is in development mode.
 */
export const menuGlobals = (st: TerminalUserStateConfig): MenuOption[] => {
    if (st.environment === EnvironmentType.Development) {
        return [menu_top, menu_back, menu_showconfig];
    }
    return [menu_top, menu_back];
}

/**
 * Function to add the options for the top level of the application,
 * without the back menu. Adds development options if the environment
 * is in development mode.
 */
export const menuGlobalsTop = (st: TerminalUserStateConfig): MenuOption[] => {
    if (st.environment === EnvironmentType.Development) {
        return [menu_top, menu_showconfig];
    }
    return [menu_top, menu_back];
}
