import type { EnvironmentType, AppLogLevel, APIKeyConfig, LoadedContext, ScriptContext } from "src/cli/types.ts";
import { Context } from "effect";

/**
 * Configuration for the terminal user state.
 */
export interface TerminalUserStateConfig {
    environment: EnvironmentType;
    logLevel: AppLogLevel;
    apiKeys: APIKeyConfig;
    loadedContext: LoadedContext;
    actionTimeout?: number;
    scriptContext: ScriptContext;
    sessionPath: string;
}

export class TerminalUserStateConfigContext extends Context.Tag("hyperfin.services.TerminalUserStateConfigContext")<
    TerminalUserStateConfigContext,
    TerminalUserStateConfig
>() {}
