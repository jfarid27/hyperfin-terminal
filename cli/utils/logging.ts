/**
 * Typed logging that allows for working with log levels set in the TerminalUserStateConfig.
 */

import { TerminalUserStateConfig, LogLevel } from "../types.ts";

export const inspectLogger = (state: TerminalUserStateConfig) => (level: LogLevel) => (message: any): void => {
    if (state.logLevel >= level) {
        if (level === LogLevel.Debug) {
            console.log(message);
        } else if (level === LogLevel.Info) {
            console.log(message);
        } else if (level === LogLevel.Warning) {
            console.log(message);
        } else if (level === LogLevel.Error) {
            console.log(message);
        }
    }
}