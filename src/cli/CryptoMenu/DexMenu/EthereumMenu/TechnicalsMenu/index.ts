/**
 * Technicals submenu (DEX / Ethereum).
 *
 * Entering `technicals` from the ethereum submenu lands here, listing one
 * option per indicator. Each option takes an optional leading contract address
 * that falls back to the loaded DEX address, e.g.
 * `bbands 0x49b5a631f54927c0007232844f06fe18cbf69786 20 2`.
 *
 * The indicator math lives in `src/technicals/` and is shared with the crypto
 * menu's technicals; `../actions/technicals.ts` resolves the DEX series and
 * hands it to the same runners.
 */

import { registerTerminalApplication } from "../../../../utils/program_loader.ts";
import { type Menu } from "../../../../types.ts";
import { technicalsMenuOptions } from "./menu.ts";

export const technicalsMenu: Menu = {
  name: "Technicals Menu",
  description: "Technical analysis indicators for on-chain tokens",
  messagePrompt: "Select an indicator:",
  options: technicalsMenuOptions,
};

export const technicalsTerminal = registerTerminalApplication(technicalsMenu);

export default technicalsTerminal;
