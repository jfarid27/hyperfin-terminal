/**
 * Technicals submenu (forex).
 *
 * Entering `technicals` from the forex menu lands here, listing one option per
 * indicator. A forex symbol is a currency pair, so each option takes
 * `[from] [to]` first and then the indicator's own parameters, e.g.
 * `bbands EUR USD 20 2`.
 *
 * The indicator math lives in `src/technicals/`, the pair/series resolution and
 * the shared `run*` steps in `../actions/technicals.ts`; this file is only menu
 * wiring.
 */

import { registerTerminalApplication } from "../../utils/program_loader.ts";
import { type Menu } from "../../types.ts";
import { technicalsMenuOptions } from "./menu.ts";

export const forexTechnicalsMenu: Menu = {
  name: "Forex Technicals Menu",
  description: "Technical analysis indicators over a currency pair",
  messagePrompt: "Select an indicator:",
  options: technicalsMenuOptions,
};

export const forexTechnicalsTerminal = registerTerminalApplication(forexTechnicalsMenu);

export default forexTechnicalsTerminal;
