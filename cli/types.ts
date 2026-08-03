import { Effect, LogLevel } from "effect";
import { ProgramError } from "./errors/index.ts";
import type { TerminalUserStateConfig } from "./services/TerminalUserState.ts";
import { TerminalUserStateConfigContext } from "./services/TerminalUserState.ts";
export type { TerminalUserStateConfig };
export { TerminalUserStateConfigContext, LogLevel };

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
export type ConfiguredLogLevel =
  | typeof LogLevel.Debug
  | typeof LogLevel.Info
  | typeof LogLevel.Warning
  | typeof LogLevel.Error;

/** Effect log levels used in terminal config (env-mapped levels plus default). */
export type AppLogLevel = ConfiguredLogLevel | typeof LogLevel.None;

export const LOG_LEVEL_ENV_MAP = {
  debug: LogLevel.Debug,
  info: LogLevel.Info,
  warning: LogLevel.Warning,
  error: LogLevel.Error,
} as const satisfies Record<string, ConfiguredLogLevel>;

export type LogLevelEnvKey = keyof typeof LOG_LEVEL_ENV_MAP;

export function isLogLevelEnvKey(value: string): value is LogLevelEnvKey {
  return value in LOG_LEVEL_ENV_MAP;
}

export function logLevelFromEnv(
  raw: string | undefined,
  defaultLevel: AppLogLevel = LogLevel.None,
): AppLogLevel {
  if (raw !== undefined && isLogLevelEnvKey(raw)) {
    return LOG_LEVEL_ENV_MAP[raw];
  }
  return defaultLevel;
}

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
    CBOE = 'cboe',
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
    [DataSourceType.CBOE]: APIKeyType.Massive;
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

export interface StocksContext {
    symbol?: string;
    datasource: DataSourceType.AlphaVantage | DataSourceType.Massive;
}

export interface OptionsContext {
    symbol?: string;
    datasource: DataSourceType.Massive | DataSourceType.CBOE;
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
    stocks: StocksContext;
    options: OptionsContext;
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

export type ActionOptions = any;

// export type ActionHandler = (st: TerminalUserStateConfig) => (...args: any[]) => Promise<CommandState>;

export type ActionHandler = (...args: any[]) =>
    Effect.Effect<CommandState, ProgramError, TerminalUserStateConfigContext>;

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
