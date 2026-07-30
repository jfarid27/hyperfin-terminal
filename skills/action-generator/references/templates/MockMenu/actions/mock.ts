import chalk from "chalk";
import {
    CommandState, CommandResultType, LogLevel,
    TerminalUserStateConfigContext
} from "./../../../../../../open_eth_terminal/types.ts";
import { inspectLogger } from "./../../../../../../open_eth_terminal/utils/logging.ts";
import model from "./../model/index.ts";
import { Effect } from "effect";

/**
 * Mock handler for the mock action. 
 * @returns 
 */
export const mockHandler = (param1: string) => Effect.gen(function*() {
    const st = yield* TerminalUserStateConfigContext;
    const applicationLogging = inspectLogger(st);

    if (!param1) {
        console.log(chalk.red("No param1 provided"));
        return {
            result: { type: CommandResultType.Error },
            state: st,
        };
    }
        
    applicationLogging(LogLevel.Debug)("Mock Param: " + param1);
    
    const result = yield* Effect.promise(() => model.api.get(param1));
    
    console.log(chalk.green("Mock Result: "));
    console.log(chalk.blue(result));
    
    return {
        result: { type: CommandResultType.Success },
        state: st,
    };
});
