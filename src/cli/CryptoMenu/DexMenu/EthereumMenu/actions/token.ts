/**
 * Shared token resolution for the Ethereum submenu's actions.
 *
 * Every action here is parametrized the same way: an optional leading address
 * argument that falls back to the loaded DEX address, validated before any
 * request goes out. Validating locally matters — CoinMarketCap answers a
 * malformed or unknown address with HTTP 200 and an empty body, so a typo
 * would otherwise surface as "no data" rather than "that is not an address".
 */

import { DataSourceType, type TerminalUserStateConfig } from "../../../../types.ts";
import { getLoadedDexAddress } from "../../../../utils/index.ts";
import { type DexTokenType, ETHEREUM_PLATFORM } from "../../types.ts";

/** An Ethereum contract address: `0x` and 40 hex characters. */
const ETHEREUM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** True for a well-formed Ethereum address (not proof that a token exists). */
export const isEthereumAddress = (value: string): boolean =>
  ETHEREUM_ADDRESS.test(value.trim());

/**
 * The address an action should use: the explicit argument, else the loaded
 * DEX address. `null` when there is nothing usable to look up.
 */
export const resolveDexAddress = (
  addressStr: string | undefined,
  fallback?: string,
): string | null => {
  const raw = (addressStr ?? fallback ?? "").trim();
  return isEthereumAddress(raw) ? raw : null;
};

/**
 * Why the address could not be used, phrased for the user.
 *
 * Distinguishes "you passed something that is not an address" from "you passed
 * nothing", because the fix is different: the first is a typo, the second is a
 * missing argument.
 */
export const addressProblem = (addressStr?: string): string => {
  const raw = (addressStr ?? "").trim();
  if (raw === "") {
    return "No token address provided.";
  }
  return `"${raw}" is not an Ethereum address (expected 0x followed by 40 hex characters).`;
};

/** The usage line shown alongside a missing or malformed address. */
export const ADDRESS_USAGE =
  "Usage: pass an ERC-20 contract address, e.g. 0x49b5a631f54927c0007232844f06fe18cbf69786";

/** Build the CoinMarketCap DEX token descriptor for an Ethereum address. */
export const ethereumToken = (address: string): DexTokenType => ({
  platform: ETHEREUM_PLATFORM,
  address: address.trim(),
  _type: DataSourceType.CoinMarketCap,
});

/** Resolve an action's address argument into a DEX token, or `null`. */
export const resolveEthereumToken = (
  st: TerminalUserStateConfig,
  addressStr?: string,
): DexTokenType | null => {
  const address = resolveDexAddress(addressStr, getLoadedDexAddress(st));
  return address === null ? null : ethereumToken(address);
};
