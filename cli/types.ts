import { Effect } from "effect";
import { ProgramError } from "./errors/index.ts";
import type { TerminalUserStateConfig } from "./services/TerminalUserState.ts";
import { TerminalUserStateConfigContext } from "./services/TerminalUserState.ts";
import { FetchService } from "./services/FetchService.ts";
import { ConfigService } from "./services/ConfigService.ts";
export type { TerminalUserStateConfig };
export { TerminalUserStateConfigContext };

/**
 * The environment types.
 */
export enum EnvironmentType {
    Debug = "debug",
    Development = "development",
    Production = "production",
}

/**
 * List of available API key types.
 */
export enum APIKeyType {
    CoinGecko = "coingecko",
    Alphavantage = "alphavantage",
    BlockchainCom = "blockchaincom",
    FreeCryptoAPI = "freecryptoapi",
    Fred = "fred",
    Massive = "massive",
}

/**
 * List of available data sources.
 */
export enum DataSourceType {
    CoinGecko = 'coingecko',
    AlphaVantage = 'alphavantage',
    BlockchainCom = 'blockchaincom',
    FreeCryptoAPI = 'freecryptoapi',
    Fred = 'fred',
    Massive = 'massive',
}

/**
 * Mapping of data source types to API key types.
 */
export interface DatasourceKeyMapping {
    [DataSourceType.CoinGecko]: APIKeyType.CoinGecko;
    [DataSourceType.AlphaVantage]: APIKeyType.Alphavantage;
    [DataSourceType.BlockchainCom]: APIKeyType.BlockchainCom;
    [DataSourceType.FreeCryptoAPI]: APIKeyType.FreeCryptoAPI;
    [DataSourceType.Fred]: APIKeyType.Fred;
    [DataSourceType.Massive]: APIKeyType.Massive;
}

/**
 * Configuration for the API keys.
 */
export type APIKeyConfig = {
    [key in APIKeyType]: string | undefined;
}

export interface CryptoContext {
    symbol?: string;
    datasource?: DataSourceType;
}

export enum PredictionMarketsType {
    Polymarket = "polymarket",
}

/**
 * Cached data for polymarket markets.
 */
export interface PolymarketMarketsData {
   tags?: { [key: string]: string }
}

export interface PredictionMarketsContext {
    type: PredictionMarketsType,
    data: PolymarketMarketsData,
}

export interface LoadedContext {
    crypto?: CryptoContext;
    predictionMarkets?: PredictionMarketsContext;
}

/**
 * Context for the currently running script allowing for tracking the current
 * command and tail commands.
 */
export interface ScriptContext {
    filename?: string;
    currentCommand?: string;
    tailCommands?: string[];
    exitAfterCompletion?: boolean;
}

/**
 * Log levels allowing for developers to order log messages. It is intended that
 * these do not affect general output messages to the user.
 *
 * The log levels are ordered from highest to lowest priority.
 * Levels:
 *  - Debug: 4 (Most verbose. Intended to show information about inputs and outputs as well as verbose data.)
 *  - Info: 3 (General extra information. Intended for showing input and output details.)
 *  - Warning: 2 (Non-critical warnings. Intended for showing possible issues.)
 *  - Error: 1 (Critical error details. Intended for showing extra information about errors.)
 *  - None: 0 (No extra information is shown. Intended for production.)
 */
export enum LogLevel {
    Debug = 4,
    Info = 3,
    Warning = 2,
    Error = 1,
    None = 0,
}

export type ActionOptions = any;

// export type ActionHandler = (st: TerminalUserStateConfig) => (...args: any[]) => Promise<CommandState>;

export type ActionHandler = (...args: any[]) =>
    Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext | FetchService | ConfigService>;

/**
 * Abstract menu option for terminal state.
 */
export interface MenuOption {
    name: string;
    command: string;
    description: string;
    action: ActionHandler;
}

/**
 * Abstract menu for terminal state.
 */
export interface Menu {
    name: string;
    description: string;
    messagePrompt: string;
    options: (st: TerminalUserStateConfig) => MenuOption[];
}

export enum CommandResultType {
    Success = "success",
    Error = "error",
    Back = "back",
    Exit = "exit",
    Timeout = "timeout",
}

/**
 * Command result data, that allows passing string and the command's result information.
 */
export interface CommandResult {
    type: CommandResultType;
    message?: string;
}

/*
 * Returned command state that signals results of a command, and
 * the updated state.
 */
export interface CommandState {
    result: CommandResult;
    state: TerminalUserStateConfig;
}
