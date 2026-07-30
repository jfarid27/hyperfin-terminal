import { ActionOptions, CommandResultType, TerminalUserStateConfig, EnvironmentType, MenuOption, TerminalUserStateConfigContext } from "../types.ts";
import { Effect } from "effect";
import { ConfigErrorTag, HTTPErrorTag, TimeoutErrorTag, UnknownError, UnknownErrorTag, type ProgramError } from "../errors/index.ts";

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
    }).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
        ),
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
    }).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
        ),
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
    }).pipe(
  Effect.catchAll((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error
    ) {
      const tag = (error as { _tag: string })._tag;
      if (
        tag === HTTPErrorTag ||
        tag === ConfigErrorTag ||
        tag === TimeoutErrorTag ||
        tag === UnknownErrorTag
      ) {
        return Effect.fail(error as unknown as ProgramError);
      }
    }
    return Effect.gen(function* () {
      yield* Effect.logError(error);
      const err = error as unknown;
      return yield* Effect.fail(new UnknownError({
        message: err instanceof Error ? err.message : "Action handler failed",
      }));
    });
  }),
        ),
};

/**
 * Function to add the options for the submenus in the application,
 * with the back menu. Adds development options if the environment
 * is in development mode.
 * @param st The current state of the application.
 * @returns The menu for the submenus in the application.
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
 * @param st The current state of the application.
 * @returns The menu for the top level of the application.
 */
export const menuGlobalsTop = (st: TerminalUserStateConfig): MenuOption[] => {
    if (st.environment === EnvironmentType.Development) {
        return [menu_top, menu_showconfig];
    }
    return [menu_top, menu_back];
}
