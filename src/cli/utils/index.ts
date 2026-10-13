import { lensPath, view, set } from "ramda";
import { TerminalUserStateConfig, DataSourceType, APIKeyType } from "../types.ts";

/**
 * Lens for the crypto loaded token on the user state config.
 * 
 * {@link TerminalUserStateConfig}
 */
export const tokenLens = lensPath(["loadedContext", "crypto", "symbol"]);

/**
 * View the loaded token on the user state config.
 * @param st The {@link TerminalUserStateConfig}
 * @returns The loaded token on the user state config.
 */
export const getLoadedToken = view<TerminalUserStateConfig, string | undefined>(tokenLens);

/**
 * Lens for the datasource on the user state config.
 */
export const datasourceLens = lensPath(["loadedContext", "crypto", "datasource"]);

/**
 * Lens for the loaded DEX token address on the user state config.
 *
 * The DEX submenu prices tokens by contract address, so this is the address a
 * bare `spot` / `chart` / `bbands` falls back to when none is given.
 */
export const dexAddressLens = lensPath(["loadedContext", "dex", "address"]);

/**
 * View the loaded DEX token address on the user state config.
 * @param st The {@link TerminalUserStateConfig}
 * @returns The address a DEX action should fall back to, if one is loaded.
 */
export const getLoadedDexAddress = view<TerminalUserStateConfig, string | undefined>(dexAddressLens);

/**
 * View the datasource on the user state config.
 * @param st The {@link TerminalUserStateConfig}
 * @returns The datasource on the user state config.
 */
export const getDatasource = view<TerminalUserStateConfig, DataSourceType | undefined>(datasourceLens);

/**
 * Set the datasource on the user state config.
 * @param datasource The datasource to set on the user state config.
 * @param st The {@link TerminalUserStateConfig}
 * @returns The updated user state config.
 */
export const setDatasource = set<DataSourceType, TerminalUserStateConfig>(datasourceLens);

/**
 * Lens for the CoinGecko API key.
 */
export const lensCoinGeckoApiKey = lensPath(["apiKeys", APIKeyType.CoinGecko]);

/**
 * Lens for FreeCryptoAPI API key.
 */
export const lensFreeCryptoAPIApiKey = lensPath(["apiKeys", APIKeyType.FreeCryptoAPI]);

/**
 * View the CoinGecko API key.
 * 
 * @param st The {@link TerminalUserStateConfig}
 * @returns The CoinGecko API key.
 */
export const getCoinGeckoApiKey = view<TerminalUserStateConfig, string | undefined>(lensCoinGeckoApiKey);

/**
 * View the FreeCryptoAPI API key.
 * 
 * @param st The {@link TerminalUserStateConfig}
 * @returns The FreeCryptoAPI API key.
 */
export const getFreeCryptoAPIApiKey = view<TerminalUserStateConfig, string | undefined>(lensFreeCryptoAPIApiKey);