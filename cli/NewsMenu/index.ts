import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, CommandResultType, TerminalUserStateConfigContext } from "../types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { redditTerminal } from "./RedditMenu/index.ts";
import { Effect } from "effect";
import { ConfigErrorTag, HTTPErrorTag, TimeoutErrorTag, UnknownError, UnknownErrorTag, type ProgramError } from "../errors/index.ts";

const newsMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    {
        name: "reddit",
        command: "reddit",
        description: "Navigate to the reddit menu",
        action: () => Effect.gen(function*() {
            const st = yield* TerminalUserStateConfigContext;
            const newState = yield* Effect.promise(async () => redditTerminal(st));
            return {
                result: { type: CommandResultType.Success },
                state: newState,
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
},
    ...menuGlobals(state),
]

const newsMenu: Menu = {
    name: "News Menu",
    description: "Source news from various sources",
    messagePrompt: "Select an option:",
    options: newsMenuOptions,
}

export const newsTerminal = registerTerminalApplication(newsMenu);

export default newsTerminal;
