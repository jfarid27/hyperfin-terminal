import { registerTerminalApplication } from "../utils/program_loader.ts";
import {
    Menu,
    MenuOption,
    TerminalUserStateConfig,
    CommandResultType,
    DataSourceType,
    TerminalUserStateConfigContext
} from "../types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { spotPriceHandler } from "./actions/spot.ts";
import { chartPriceHandler } from "./actions/chart.ts";
import chalk from "chalk";
import { lensPath, set, includes} from "ramda";
import { Effect } from 'effect';

const cryptoMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
    {
        name: "price",
        command: "price [symbol]",
        description: "Fetch current price for the given symbol",
        action: spotPriceHandler,
    },
    {
        name: "chart",
        command: "chart [symbol]",
        description: "Fetch chart for the given symbol",
        action: chartPriceHandler,
    },
    {
        name: "set",
        command: "set <settingtype> [value]",
        description: "Set or get loading options",
        action: (settingType: string, value?: string ) => Effect.gen(function* () { 
            const st = yield* TerminalUserStateConfigContext;
            
            if (!settingType) {
                console.log(chalk.blue("You did not specify a setting type."))
                return {
                    result: { type: CommandResultType.Error},
                    state: st,
                };
            }
            
            if (settingType === "datasource") {
                const datasources = Object.values(DataSourceType);
                if (value && includes(value, datasources)) {
                    const newState = set(lensPath(['loadedContext', 'datasource']), value, st);
                    console.log(chalk.green(`Datasource set to ${value}`));
                    return {
                        result: { type: CommandResultType.Success },
                        state: newState,
                    };
                } else {
                    console.log(chalk.red(`Invalid datasource value: ${value}`));
                    return {
                        result: { type: CommandResultType.Error },
                        state: st,
                    };
                }
                
            }
            
            if (settingType === "symbol") {
                if (value) {
                    const newState = set(lensPath(['loadedContext', 'symbol']), value, st);
                    console.log(chalk.green(`Symbol set to ${value}`));
                    return {
                        result: { type: CommandResultType.Success },
                        state: newState,
                    };
                } else {
                    console.log(chalk.red(`Invalid symbol value: ${value}`));
                    return {
                        result: { type: CommandResultType.Error },
                        state: st,
                    };
                }
            }
            
            return {
                result: { type: CommandResultType.Success },
                state: st,
            };
        }),
    },
    ...menuGlobals(state),
]

const cryptoMenu: Menu = {
    name: "Crypto Menu",
    description: "Crypto Menu",
    messagePrompt: "Select an option:",
    options: cryptoMenuOptions,
}

export const cryptoTerminal = registerTerminalApplication(cryptoMenu);

export default cryptoTerminal;
