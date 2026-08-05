import chalk from "chalk";
import {
    CommandState, CommandResultType,
    TerminalUserStateConfigContext
} from "src/cli/types.ts";
import model from "./../model/index.ts";
import { Effect } from "effect";

/**
 * Mock handler for the mock action.
 * @returns
 */
export const mockHandler = (param1: string) => Effect.gen(function*() {
    const st = yield* TerminalUserStateConfigContext;

    if (!param1) {
        console.log(chalk.red("No param1 provided"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }

    yield* Effect.logDebug("Mock Param: " + param1);

    const result = yield* Effect.promise(() => model.api.get(param1));

    console.log(chalk.green("Mock Result: "));
    console.log(chalk.blue(result));

    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
});
