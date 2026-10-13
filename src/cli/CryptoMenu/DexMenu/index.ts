/**
 * DEX submenu (crypto).
 *
 * Entering `dex` from the crypto menu lands here. This is the on-chain arm of
 * the crypto menu: it prices tokens that no exchange lists, by looking them up
 * on their chain rather than by ticker.
 */

import { registerTerminalApplication } from "../../utils/program_loader.ts";
import { type Menu } from "../../types.ts";
import { dexMenuOptions } from "./menu.ts";

export const dexMenu: Menu = {
  name: "DEX Menu",
  description: "On-chain token prices by contract address",
  messagePrompt: "Select a chain:",
  options: dexMenuOptions,
};

export const dexTerminal = registerTerminalApplication(dexMenu);

export default dexTerminal;
