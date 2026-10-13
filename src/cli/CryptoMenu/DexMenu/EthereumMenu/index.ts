/**
 * Ethereum submenu (DEX).
 *
 * Entering `ethereum` from the DEX menu lands here: prices and charts on-chain
 * tokens by contract address, which the ticker-based crypto menu cannot do.
 */

import { registerTerminalApplication } from "../../../utils/program_loader.ts";
import { type Menu } from "../../../types.ts";
import { ethereumMenuOptions } from "./menu.ts";

export const ethereumMenu: Menu = {
  name: "Ethereum Menu",
  description: "Ethereum token prices by contract address",
  messagePrompt: "Select an option:",
  options: ethereumMenuOptions,
};

export const ethereumTerminal = registerTerminalApplication(ethereumMenu);

export default ethereumTerminal;
