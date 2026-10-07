/**
 * Technicals submenu (crypto).
 *
 * Entering `technicals` from the crypto menu lands here, listing one option per
 * indicator. Each option keeps the chart-style parameter structure — an
 * optional leading symbol that falls back to the loaded token — plus the
 * indicator's own parameters, e.g. `bbands bitcoin 20 2`.
 *
 * The indicator math lives in `src/technicals/`; the actions in
 * `../actions/technicals.ts`; this file is only menu wiring.
 */

import { registerTerminalApplication } from "../../utils/program_loader.ts";
import { type Menu } from "../../types.ts";
import { technicalsMenuOptions } from "./menu.ts";

const technicalsMenu: Menu = {
  name: "Technicals Menu",
  description: "Technical analysis indicators",
  messagePrompt: "Select an indicator:",
  options: technicalsMenuOptions,
};

export const technicalsTerminal = registerTerminalApplication(technicalsMenu);

export default technicalsTerminal;
